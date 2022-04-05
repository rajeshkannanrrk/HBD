import { ILogContext, Logger } from "healthbotcommon/logger";
const logger = Logger.getInstance();

import { AuthProvider, LightScenario, LocalizedString, SkillInfo, Scenario, ScenarioBackupEntity } from "healthbotcommon/tenantcontent";
import { BackupImageData, DataConnectionBackupData } from "../../../definitions/backup-restore/BackupImageData";
import { ResourceFile } from "../../../definitions/backup-restore/ResourceFile";
import { IAccount } from "../../../definitions/Request/Account";
import { IRequestUser } from "../../../definitions/Request/RequestUser";
import * as mainModel from "../main.model";
import * as integrity from "./integrity.model";
import { logBackup } from "../../../services/auditTrailsLogger";
import { tenantContents } from "../../../modules/globals";
import * as password from 'generate-password';
import { promisify } from "util";
import * as fs from "fs";

const uuid = require('node-uuid');
const merge = require('merge');
const sanitize = require("sanitize-filename");

const mkdirAsync = promisify(fs.mkdir);
const rmdirAsync = promisify(fs.rmdir);
const unlinkAsync = promisify(fs.unlink);
const writeFileAsync = promisify(fs.writeFile);

/**
 * This is the main restore function. it will do the following process:
 * 1. parse the backup image (if needed, decrypt it)
 * 2. validate that the restore process is valid
 * 2.1 Verify that merging the scenarios won't cause a duplication of triggers
 * 2.2 Verify that none of the restored scenarios are partially conflicting existing scenarios
 * 3. do the actual data merge, step by step (not parallel, to lower the risk of connectivity problems during this process)
 * 4. failed or not, log this action and reload tenant. this is needed as in any case, we know that potentially something changed with the bot.
 *
 * @param account
 * @param fileData
 * @param user
 * @param decrypt
 */
export async function restoreBackup(account: IAccount, fileData: string, user: IRequestUser, decrypt: boolean) {
    // step #1 - convert the file to json object. decrypt file if needed.
    let backupImageData: BackupImageData;

    try {
        try {
            backupImageData = JSON.parse(await integrity.decrypt(fileData));
            logger.info(null, `restore succeeded`);
        } catch (e) {
            try {
                logger.info(null, `restore failed, trying to restore according to old method`);
                backupImageData = JSON.parse(await integrity.decryptOldVersions(fileData));
                logger.info(null, `restore using old method succeeded`);
            } catch (err) {
                if (!decrypt) {
                    backupImageData = JSON.parse(fileData);
                } else {
                    throw e;
                }
            }
        }
    } catch (e) {
        throw new Error("Corrupted backup file");
    }

    return restore(account, backupImageData, user, true);
}

export async function restore(account: IAccount, backupImageData: BackupImageData, user: IRequestUser, override: boolean, templateId?: string) {
    const logContextObject: ILogContext = {
        logContext: {
            account: {
                name: account.name,
                id: account.id
            },
            action: "restore"
        }
    };

    // verify the restore action will not cause conflicts
    // * make sure scenarios merge will not cause duplicated
    await validateScenarios(account, backupImageData.scenarios, logContextObject, override);

    logger.debug(logContextObject, `[Restore] [${account.name}] Starting restore`);
    let errorDuringMerge = false;
    try {
        await mergeScenarios(account, backupImageData.scenarios, logContextObject, templateId);
        await mergeConfiguration(account, backupImageData.configuration, logContextObject, override);
        await mergeLocalization(account, backupImageData.localization, logContextObject);
        await mergeDataConnections(account, backupImageData.dataConnections, logContextObject);
        await mergeAuthenticationProviders(account, backupImageData.authenticationProviders, logContextObject);
        await mergeRegisteredSkills(account, backupImageData.skills, logContextObject);
        await mergeFiles(account, backupImageData.files, logContextObject);
        logger.debug(logContextObject, `[Restore] [${account.name}] Restore completed successfully`);
    }
    catch (restoreError) {
        logger.debug(logContextObject, `[Restore] [${account.name}] Restore failed`);
        logger.exception(null, restoreError);
        errorDuringMerge = true;
    }
    logBackup(account.name, "imported", user.emails[0].value);
    mainModel.reloadTenant(account.name);
    if (errorDuringMerge) {
        throw new Error("The restore process was not completed successfully.");
    }
}

/**
 * This function take care of validating 2 things
 * 1. Verify that merging the scenarios won't cause a duplication of triggers
 * 2. Verify that none of the restored scenarios are partially conflicting existing scenarios
 *
 * @param account
 * @param restoredScenarios
 */
async function validateScenarios(account: IAccount, restoredScenarios: ScenarioBackupEntity[], logContextObject: ILogContext, override: boolean) {
    logger.debug(logContextObject, `[Restore] [${account.name}] Validating scenarios for conflicts`);
    // list all scenarios
    const accountExistingScenarios: LightScenario[] = await tenantContents[account.name].scenarios.listLightScenarios();
    const namesToTriggers = new Map<string, string>();
    const usedTriggers = new Set<string>();
    for (const scenario of accountExistingScenarios) {
        namesToTriggers.set(scenario.name, scenario.scenario_trigger);
        usedTriggers.add(scenario.scenario_trigger);
    }
    const conflictMsg = "This file has conflicts. Select a different file to complete restore";
    for (const scenario of restoredScenarios) {
        if (namesToTriggers.get(scenario.name)) {
            if (!override) {
                throw new Error(`Scenario named ${scenario.name} already exists`);
            }
            if (namesToTriggers.get(scenario.name) !== scenario.scenario_trigger) {
                throw new Error(conflictMsg);
            }
        }
        else if (usedTriggers.has(scenario.scenario_trigger)) {
            throw (override ?
                new Error(conflictMsg) :
                new Error(`Scenario Id ${scenario.scenario_trigger} already exists`));
        }
        namesToTriggers.set(scenario.name, scenario.scenario_trigger);
        usedTriggers.add(scenario.scenario_trigger);
    }
}

/**
 * This function will merge scenarios on top of existing scenarios.
 * this means replacing content for overriding cases, and creating new content for the rest.
 *
 * @param account
 * @param scenariosToRestore
 */
async function mergeScenarios(account: IAccount, scenariosToRestore: ScenarioBackupEntity[], logContextObject: ILogContext, templateId: string) {
    if (!scenariosToRestore || scenariosToRestore.length === 0) {
        logger.debug(logContextObject, `[Restore] [${account.name}] No scenarios to merge`);
        return;
    }
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging scenarios started`);
    const existingScenarios: LightScenario[] = await tenantContents[account.name].scenarios.listLightScenarios();
    const nameToId = new Map<string, string>();
    for (const existingScenario of existingScenarios) {
        nameToId.set(existingScenario.name, existingScenario.RowKey);
    }

    await Promise.all(scenariosToRestore.map(async (scenario) => {
        const alreadyExists = !!nameToId.get(scenario.name);
        scenario.RowKey = (nameToId.get(scenario.name)) ? nameToId.get(scenario.name) : uuid.v4();
        try {

            // Create snapshot before importing the scenario
            if (await tenantContents[account.name].scenarios.checkScenarioExists(scenario.RowKey)) {
                await tenantContents[account.name].scenarios.createSnapshot(scenario.RowKey);
                scenario.snapshots = (scenario.snapshots ?? 0) + 1;
            }
            else {
                scenario.snapshots = 0;
            }
            const scenarioToCreate: Scenario = {
                RowKey: scenario.RowKey,
                snapshots: scenario.snapshots,
                name: scenario.name,
                scenario_trigger: scenario.scenario_trigger,
                description: scenario.description,
                userDisplayName: scenario.userDisplayName,
                active: scenario.active,
                version: scenario.version,
                updated: scenario.updated,
                currentUser: scenario.currentUser,
                breaking: scenario.code.breaking,
                interrupting: scenario.code.interrupting,
                returningMessage: scenario.code.returningMessage,
                code: {
                    version: scenario.code.version,
                    steps: scenario.code.steps
                }
            };
            if (alreadyExists) {
                await tenantContents[account.name].scenarios.updateScenario(scenarioToCreate);
            }
            else {
                await tenantContents[account.name].scenarios.createScenario(scenarioToCreate);
            }
        } catch (e) {
            logger.error(null, `[Restore] [${account.name}] Error while saving scenario ${scenario.name}`);
            scenario.RowKey = null;
        }
    }));

    logger.debug(logContextObject, `[Restore] [${account.name}] Merging scenarios ended`);
}

/**
 * This function will apply configuration with the following rules:
 * 1. Environment variables list will be merged specifically due to it being an array.
 * 2. All other configurations (including language models) will be merged to existing (overriding existing setting)
 *
 * @param account
 * @param restoredConfig
 */
async function mergeConfiguration(account: IAccount, restoredConfig: any, logContextObject: ILogContext, override: boolean) {
    if (restoredConfig === undefined) {
        logger.debug(logContextObject, `[Restore] [${account.name}] No configuration to merge`);
        return;
    }
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging configuration started`);

    logger.debug(logContextObject, `[Restore] [${account.name}] Reading existing configuration`);
    const existingConfig = await tenantContents[account.name].config.getOverrides();

    // merge env variables array
    const existingEnvironmentVariables: Array<{name: string; value: string}> = (existingConfig.environment_variables) ? existingConfig.environment_variables.variables : undefined;
    const restoredEnvironmentVariables: Array<{name: string; value: string}> = (restoredConfig.environment_variables) ? restoredConfig.environment_variables.variables : undefined;

    if (existingEnvironmentVariables || restoredEnvironmentVariables) {
        const environmentVariables = new Map<string, string>();
        if (existingEnvironmentVariables) {
            for (const variable of existingEnvironmentVariables) {
                environmentVariables.set(variable.name, variable.value);
            }
        }
        if (restoredEnvironmentVariables) {
            for (const variable of restoredEnvironmentVariables) {
                environmentVariables.set(variable.name, variable.value);
            }
        }
        if (!restoredConfig.hasOwnProperty("environment_variables")) {
            restoredConfig.environment_variables = {};
        }
        restoredConfig.environment_variables.variables = (Array(...environmentVariables.entries())).map(([name, value]) => ({name, value}));
    }

    // merge help array
    const existingHelpMenuItems =
        (existingConfig.conversation && existingConfig.conversation["/builtin/help"] && existingConfig.conversation["/builtin/help"].menu_items) ?
            existingConfig.conversation["/builtin/help"].menu_items : undefined;
    const restoredHelpMenuItems =
        (restoredConfig.conversation && restoredConfig.conversation["/builtin/help"] && restoredConfig.conversation["/builtin/help"].menu_items) ?
            restoredConfig.conversation["/builtin/help"].menu_items : undefined;
    if (!override && existingHelpMenuItems) {
        if (!restoredConfig.conversation) {
            restoredConfig.conversation = {};
        }
        if (!restoredConfig.conversation.hasOwnProperty("/builtin/help")) {
            restoredConfig.conversation["/builtin/help"] = {};
        }
        const helpMenuItems = new Map<string, boolean>();
        for (const variable of existingHelpMenuItems) {
            helpMenuItems.set(variable.text, variable.interrupting);
        }
        if (restoredHelpMenuItems) {
            for (const variable of restoredHelpMenuItems) {
                helpMenuItems.set(variable.text, variable.interrupting);
            }
        }
        restoredConfig.conversation["/builtin/help"].menu_items = (Array(...helpMenuItems.entries())).map(([text, interrupting]) => ({text, interrupting}));
    }

    const mergedTenantConfig = merge.recursive ({}, existingConfig, restoredConfig);
    await tenantContents[account.name].config.save(mergedTenantConfig);
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging configuration ended`);
}

/**
 * This function will insert or merge system and custom localized strings.
 *
 * @param account
 * @param localization
 */
async function mergeLocalization(account: IAccount, localization: { system: LocalizedString[], custom: LocalizedString[] }, logContextObject: ILogContext) {
    const cleanOldBackups = ({ PartitionKey, RowKey, Timestamp, "odata.etag": _, ...localizedString }: any) => localizedString;

    logger.debug(logContextObject, `[Restore] [${account.name}] Merging system localized strings started`);
    await tenantContents[account.name].localization.system.saveChanges(localization.system.map(cleanOldBackups));
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging system localized strings ended`);

    logger.debug(logContextObject, `[Restore] [${account.name}] Merging custom localized strings started`);
    await tenantContents[account.name].localization.custom.saveChanges(localization.custom.map(cleanOldBackups));
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging custom localized strings ended`);
}

/**
 * This function will insert or replace (for name match) data connections
 *
 * @param account
 * @param dataConnections
 */
async function mergeDataConnections(account: IAccount, dataConnections: DataConnectionBackupData[], logContextObject: ILogContext) {
    if (!dataConnections || dataConnections.length === 0) {
        logger.debug(logContextObject, `[Restore] [${account.name}] No data connections to merge`);
        return;
    }
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging data connections started`);
    const existingNamesToId = new Map<string, string>();
    const existingDataConnections = await tenantContents[account.name].dataConnections.getAll();
    for (const existingDataConnection of existingDataConnections) {
        existingNamesToId.set(existingDataConnection.name, existingDataConnection.id);
    }

    // delete duplicates first
    const actionTime = new Date().getTime();
    await Promise.all(dataConnections.map(async ({ static_parameters, PartitionKey, RowKey, ...dataConnection }, i) => {
        await tenantContents[account.name].dataConnections.update({
            ...dataConnection,
            static_parameters: typeof static_parameters === "string" ? JSON.parse(static_parameters) : static_parameters,
            id: existingNamesToId.get(dataConnection.name) || (actionTime + i).toString()
        });
    }));
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging data connections ended`);
}

/**
 * This function will insert or replace (for name match) authentication providers
 *
 * @param account
 * @param authenticationProviders
 */
async function mergeAuthenticationProviders(account: IAccount, authenticationProviders: AuthProvider[], logContextObject: ILogContext) {
    if (!authenticationProviders || authenticationProviders.length === 0) {
        logger.debug(logContextObject, `[Restore] [${account.name}] No authentication providers to merge`);
        return;
    }
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging authentication providers started`);
    const existingNamesToId = new Map();
    const existingAuthProviders = await tenantContents[account.name].authProviders.getAll();
    for (const authProvider of existingAuthProviders) {
        existingNamesToId.set(authProvider.name, authProvider.id);
    }

    // delete duplicates first
    const actionTime = new Date().getTime();
    await Promise.all(authenticationProviders.map(async (authProvider, i) => {
        await tenantContents[account.name].authProviders.update({
            ...authProvider,
            id: existingNamesToId.get(authProvider.name) || (actionTime + i).toString()
        });
    }));
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging authentication providers ended`);
}

/**
 * This function will merge skills list
 *
 * @param account
 * @param restoredSkills
 */
async function mergeRegisteredSkills(account: IAccount, restoredSkills: SkillInfo[], logContextObject: ILogContext) {
    if (!restoredSkills || restoredSkills.length === 0) {
        logger.debug(logContextObject, `[Restore] [${account.name}] no skills to merge`);
        return;
    }
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging skills started`);
    const skills = new Map<string, SkillInfo>();
    const existingSkills: SkillInfo[] = await tenantContents[account.name].registeredSkillsClient.get();
    for (const skill of existingSkills) {
        skills.set(skill.manifestUrl, skill);
    }
    for (const restoredSkill of restoredSkills) { // Override existing skills with the restored ones.
        skills.set(restoredSkill.manifestUrl, restoredSkill);
    }
    await tenantContents[account.name].registeredSkillsClient.merge(Array.from(skills.values()));
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging skills ended`);
}

/**
 * This function will add or replace (for name match) files
 *
 * @param account
 * @param files
 */
async function mergeFiles(account: IAccount, files: ResourceFile[], logContextObject: ILogContext) {
    if (!files || files.length === 0) {
        logger.debug(logContextObject, `[Restore] [${account.name}] no files to merge`);
        return;
    }
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging files started`);
    await Promise.all(files.map(async (file) => {
        const fileDecoded = ResourceFile.decode(file.content);
        const tempDir = "../" + password.generate({length: 8, numbers: true});
        await mkdirAsync(tempDir);
        logger.debug(null, "creating temp folder " + tempDir);
        const filePath = tempDir + "/" + sanitize(file.name);
        await writeFileAsync(filePath, fileDecoded);
        logger.debug(null, "writing blob from file");
        await tenantContents[account.name].resources.upload(file.name, filePath);
        await unlinkAsync(filePath);
        logger.debug(null, "removing temp file " + filePath);
        await rmdirAsync(tempDir);
    }));
    logger.debug(logContextObject, `[Restore] [${account.name}] Merging files ended`);
}
