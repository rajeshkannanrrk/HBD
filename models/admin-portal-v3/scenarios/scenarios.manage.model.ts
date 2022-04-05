import { Logger } from 'healthbotcommon/logger';
const logger = Logger.getInstance();
import * as MicrosoftGraph from "@microsoft/microsoft-graph-client";
import * as mainModel from "../main.model";
import { IAccount } from '../../../definitions/Request/Account';
import * as obiConverter from "../../../modules/obiConverter";
import * as scenariosValidationModel from "./scenarios.validation.model";
import { tenantContents } from '../../../modules/globals';
import { logScenarioChange, logSnapshotChange } from "../../../services/auditTrailsLogger";
import { LightScenario, Scenario, UpdateScenarioParameters } from "healthbotcommon/tenantcontent";
import { BlobGetPropertiesResponse } from "@azure/storage-blob";
import "isomorphic-fetch";

export enum ScenarioErrorSeverity {
    warning = "warning",
    problem = "problem",
    error = "error"
}

export interface IExportData {
    scenarioId: string;
    data: any;
}

export enum VariableScope {
    scenario = "scenario",
    conversation = "conversation",
    user = "user"
}

export class ScenarioError extends Error {
    public text: string;
    public severity: ScenarioErrorSeverity;
    public stepId?: string;
    public constructor(message: string, severity: ScenarioErrorSeverity = ScenarioErrorSeverity.error, stepId?: string) {
        super(message);
        this.text = message;
        this.severity = severity;
        this.stepId = stepId;
    }
}

const uuid = require('node-uuid');

export async function getBeginableBuiltinScenarios(account: IAccount): Promise<string[]> {
    const tenantConfig = await tenantContents[account.name].config.load();

    return tenantConfig.get("environment_variables.beginable_builtin_dialogs");
}

export async function createNewScenario(account: any, user: any, parameters: any, optionalCode?: any): Promise<string> {
    const id: string = uuid.v4();
    const newScenario: Partial<Scenario> = {
        RowKey: id,
        name: parameters.name,
        scenario_trigger: parameters.trigger,
        description: parameters.description,
        userDisplayName: user.displayName,
        active: true,
        version: 1.0,
        updated: new Date(),
        code: {
            version: (optionalCode && optionalCode.version) || 3,
            steps: (optionalCode && optionalCode.steps) || [],
        },
        interrupting: parameters.interrupting || false,
        breaking: parameters.interrupting ? parameters.breaking || false : false,
        returningMessage: parameters.returningMessage || ""
    };
    await tenantContents[account.name].scenarios.createScenario(newScenario as Scenario);
    mainModel.reloadScenario(account.name, parameters.trigger, parameters.trigger, true, newScenario.code);
    if (optionalCode === undefined) { // Avoid Logging "Created" when Clone/Import scenario is performed.
        logScenarioChange(account.name, "created", user.emails[0].value, parameters.name, parameters.trigger);
    }
    return id;
}

export async function createImportedScenario(account: any, originalScenarioId: string, user: any, parameters: any, code: any): Promise<void> {
    if (await tenantContents[account.name].scenarios.checkScenarioExists(originalScenarioId)) {
        const scenarioMetadata: UpdateScenarioParameters = {
            RowKey: originalScenarioId,
            name : parameters.name,
            scenario_trigger: parameters.trigger,
            description : parameters.description,
            updated: new Date(),
            interrupting: parameters.interrupting,
            returningMessage: parameters.returningMessage,
            breaking: parameters.breaking

        };
        await tenantContents[account.name].scenarios.createSnapshot(originalScenarioId);
        await tenantContents[account.name].scenarios.updateScenario({...scenarioMetadata, code});
        await updateSnapshotsCount(originalScenarioId, account);
        logSnapshotChange(account.name, "created", user.emails[0].value, originalScenarioId, undefined);
    }
    else {
        await createNewScenario(account, user, parameters, code);
    }
    logScenarioChange(account.name, "imported", user.emails[0].value, parameters.name, parameters.trigger);

}

export async function updateScenarioMetadata(account: any, scenarioId: string, parameters: any, user: any): Promise<void> {
    const scenario: Scenario = await tenantContents[account.name].scenarios.getScenario(scenarioId);

    // updating metadata
    const updatedScenario: UpdateScenarioParameters = {
        RowKey: scenarioId,
        name : parameters.name,
        scenario_trigger: parameters.trigger,
        description : parameters.description,
        userDisplayName : user.displayName,
        updated: new Date(),
        interrupting: parameters.interrupting,
        breaking: parameters.breaking,
        returningMessage: parameters.returningMessage
    };

    // updating scenario code
    await tenantContents[account.name].scenarios.updateScenario(updatedScenario);
    mainModel.reloadScenario(account.name, scenario.scenario_trigger, parameters.trigger, scenario.active, JSON.stringify(scenario.code));
    logScenarioChange(account.name, "modified", user.emails[0].value, parameters.name, parameters.trigger);
}

/**
 * This function is used for cloning an existing scenario.
 *
 * @param account
 * @param scenarioId - The ID of the scenario we want to clone.
 * @param parameters - Holding the values of interrupting, breaking, returningMessage
 * @param user
 * @return A promise resolved with the id of the new scenario.
 */
export async function cloneExistingScenario(account: any, scenarioId: string, parameters: any, user: any): Promise<string> {
    // Get the code of the scenario we want to clone
    const scenario: Scenario = (await tenantContents[account.name].scenarios.getScenario(scenarioId));
    // Add new scenario to the cloud
    const newScenarioID = await createNewScenario(account, user, parameters, scenario.code);
    logScenarioChange(account.name, "cloned", user.emails[0].value, parameters.name, parameters.trigger);
    return newScenarioID;
}

export async function updateScenarioCode(account: any, scenarioId: string, code: string, deactivate: boolean, user: any, baseUrl: string): Promise<void> {
    const scenario: Scenario = await tenantContents[account.name].scenarios.getScenario(scenarioId);
    const newCode = JSON.parse(code);

    const updatedScenario: UpdateScenarioParameters = {
        RowKey: scenarioId,
        userDisplayName: user.displayName,
        updated: new Date(),
        active: deactivate ? false : scenario.active,
        returningMessage: scenario.returningMessage,
        interrupting: scenario.interrupting,
        breaking: scenario.breaking,
        code: newCode

    };
    await tenantContents[account.name].scenarios.updateScenario(updatedScenario);
    mainModel.reloadScenario(account.name, scenario.scenario_trigger, scenario.scenario_trigger, updatedScenario.active, newCode);
    logScenarioChange(account.name, "modified", user.emails[0].value, scenario.name, scenario.scenario_trigger);
    if (baseUrl) {
        addUserActivity(scenarioId, scenario.name, scenario.description, user, baseUrl, account.name);
    }
}

export async function activateScenario(account: any, id: string, editor: any): Promise<void> {
    const scenario: Scenario = await tenantContents[account.name].scenarios.getScenario(id);

    // if validation fails for some reason, it will throw error
    await scenariosValidationModel.validateScenario(id, account, scenario.name, scenario.scenario_trigger, JSON.stringify(scenario.code), false);

    // if we arrived here, validation found no error
    const updateScenario: UpdateScenarioParameters = {
        RowKey: id,
        active : true
    };
    await tenantContents[account.name].scenarios.updateScenario(updateScenario);
    mainModel.reloadScenario(account.name, scenario.scenario_trigger, scenario.scenario_trigger, true, scenario.code ? scenario.code : undefined);
    logScenarioChange(account.name, "activated", editor.emails[0].value, scenario.name, scenario.scenario_trigger);
}

export async function deactivateScenario(account: any, id: string, editor: any): Promise<void> {
    const scenario: Scenario = await tenantContents[account.name].scenarios.getScenario(id);
    const updateScenario: UpdateScenarioParameters = {
        RowKey: id,
        active : false
    };
    await tenantContents[account.name].scenarios.updateScenario(updateScenario);
    mainModel.reloadScenario(account.name, scenario.scenario_trigger, scenario.scenario_trigger, false, scenario.code ? scenario.code : undefined);
    logScenarioChange(account.name, "deactivated", editor.emails[0].value, scenario.name, scenario.scenario_trigger);
}

export async function getExportJson(scenariosNames: string, account: any): Promise<IExportData[]>{
    const accountScenarios: LightScenario[] = await tenantContents[account.name].scenarios.listLightScenarios();
    const scenarios: IExportData[] = [];
    const ScenariosIds = [];
    for (const scenario of accountScenarios) {
        if (scenariosNames === "all" || scenariosNames.includes(scenario.name)) {
            scenarios.push({
                scenarioId: scenario.name,
                data: {
                    name: scenario.name,
                    id: scenario.RowKey,
                    scenario_trigger: scenario.scenario_trigger,
                    description: scenario.description,
                    active: scenario.active,
                    updated: scenario.updated,
                    userDisplayName: scenario.userDisplayName
                }
            });
            ScenariosIds.push(scenario.RowKey);
        }
    }
    if (Array.isArray(scenariosNames) && scenarios.length !== scenariosNames.length) {
        throw new Error("scenario name not found");
    }
    const scenariosJsons = await getScenarios(account.name, ScenariosIds);
    for (let i = 0; i < scenarios.length; i++) {
        scenarios[i].data.code = scenariosJsons[i];
    }
    return scenarios;
}

/**
 * Export the scenarios into AdaptiveDialog format
 *
 * @param scenarioNames
 * @param account
 */
export async function getExportOBIDialog(scenarioNames: string, account: IAccount): Promise<IExportData[]> {
    const scenarios = [];
    const dialogs: IExportData[] = [];

    const ScenariosIds = [];
    const [accountScenarios, tenantConfig, localizationData] =  await Promise.all([
        tenantContents[account.name].scenarios.listLightScenarios(),
        tenantContents[account.name].config.load(),
        tenantContents[account.name].localization.system.get()
    ]);

    const languageUnderstanding = tenantConfig.get('language_understanding');

    for (const scenario of accountScenarios) {
        if (scenarioNames === "all" || scenarioNames.includes(scenario.name)) {
            scenarios.push({
                id: scenario.RowKey,
                name: scenario.name,
                scenario_trigger: scenario.scenario_trigger,
                description: scenario.description,
                active: scenario.active,
                updated: scenario.updated,
                userDisplayName: scenario.userDisplayName
            });
            ScenariosIds.push(scenario.RowKey);
        }
    }
    if (Array.isArray(scenarioNames) && scenarios.length !== scenarioNames.length) {
        throw new Error("scenario name not found");
    }
    const scenariosJsons = await getScenarios(account.name, ScenariosIds);
    for (let i = 0; i < scenarios.length; i++) {
        const code = JSON.parse(scenariosJsons[i]);
        const scenarioId = scenarios[i].scenario_trigger;
        dialogs.push({
            scenarioId,
            data: obiConverter.convert(scenarioId, code, languageUnderstanding, localizationData)
        });
    }
    return dialogs;
}

export function archiveAndSendScenarios(scenarios: any[], res: any, extension: string): void {
    const archiver = require('archiver');
    const archive = archiver('zip');

    archive.on('error', (err) => {
        res.status(500).send({error: err.message});
    });
    // on stream closed we can end the request
    archive.on('end', () => {
        logger.debug(null, 'Archive wrote %d bytes', archive.pointer());
    });

    // set the archive name
    res.setHeader("Content-disposition", "attachment; filename= scenarios.zip");
    res.setHeader('Content-type', 'application/zip');
    // this is the streaming magic
    archive.pipe(res);
    for (const scenario of scenarios) {
        archive.append(JSON.stringify(scenario.data, undefined, " "), {name: `${scenario.scenarioId}.${extension}`});
    }
    archive.finalize();
}

export async function importFromJson(scenarios: any[], account: any, editor: any): Promise<void>{
    const accountScenarios: LightScenario[] = await tenantContents[account.name].scenarios.listLightScenarios();
    const scenariosToBeSaved = scenarios.map((scenario) => {
        let id = getScenarioIdByName(scenario.name, accountScenarios);
        if (id.length === 0) {
            id = uuid.v4();
        }
        const scnearioCode = (typeof (scenario.code) === 'object') ? scenario.code : JSON.parse(scenario.code);
        if (scenario.scenario_trigger === undefined) {
            scenario.scenario_trigger = scnearioCode.name || scenario.name;
        }
        if (scenario.active === undefined) {
            scenario.active = true;
        }
        return {
            id,
            scenarioName : scenario.name,
            scenarioTrigger: scenario.scenario_trigger,
            scenarioDescription: scenario.description,
            scenarioCode: scenario.code,
            scenarioActive: scenario.active,
            breaking: scenario.code.breaking,
            returningMessage: scenario.code.returningMessage,
            interrupting: scenario.code.interrupting
        };
    });
    const savedScenarios = scenariosToBeSaved.map((scenario) =>
        createImportedScenario(account, scenario.id, editor, {name: scenario.scenarioName, trigger: scenario.scenarioTrigger, description: scenario.scenarioDescription, interrupting: scenario.interrupting, returningMessage: scenario.returningMessage, breaking: scenario.breaking}, JSON.parse(scenario.scenarioCode))
    );

    await Promise.all(savedScenarios);
    mainModel.reloadTenant(account.name);
}

export function scenarioFilesToObjects(files) {
    const importedScenarios = [];
    for (const key of Object.keys(files)) {
        importedScenarios.push(scenarioStringToObject(key, String(files[key].data)));
    }
    return importedScenarios;
}

function addUserActivity(id: string, name: string, description: string, user: any, baseUrl: string, accountName: string) {
    const appActivityId = id;

    const client = MicrosoftGraph.Client.init( {
        authProvider: (done) => {
            done(undefined, user.accessToken);

        }
    });

    const content = {
        appActivityId,
        activitySourceHost: baseUrl,
        appDisplayName: "Health Bot Management Portal",
        activationUrl: `${baseUrl}/account/${accountName}/scenario-editor/${id}`,
        fallbackUrl: `${baseUrl}/account/${accountName}/scenario-editor/${id}`,

        visualElements: {
            attribution: {
                iconUrl: `${mainModel.blobService.getUrl("resources")}/${accountName}/logo.png`,
                alternateText: "Health Bot",
                addImageQuery: "false",
            },
            description: `Scenario ${name} saved`,
            backgroundColor: "#008272",
            displayText: name,
            content: {
                $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                body:
                    [
                        {
                            type: "TextBlock",
                            text:  name,
                            size: "large",
                            weight: "bolder"
                        },
                        {
                            type: "TextBlock",
                            text: accountName
                        },
                        {
                            type: "TextBlock",
                            text: description
                        }
                    ]
            }
        },
        historyItems: [
            {
                startedDateTime: new Date()
            }
        ]
    };

    return client.api(`/me/activities/${appActivityId}`).put(JSON.stringify(content));
}

async function getScenarios(accountName: string, scenariosIds: string[]): Promise<string[]> {
    const promises = scenariosIds.map(async (scenarioId) => {
        const scenario = await tenantContents[accountName].scenarios.getScenario(scenarioId);
        return {
            ...scenario.code,
            breaking: scenario.breaking,
            interrupting: scenario.interrupting,
            returningMessage: scenario.returningMessage
        };
    });
    const scenariosBodies = await Promise.all(promises);
    return scenariosBodies.map((scenarioBody) => JSON.stringify(scenarioBody));
}

export function getScenarioIdByName(name: string, scenarios: any[]): string {
    for (const scenario of scenarios) {
        if (name === scenario.name) {
            return scenario.RowKey;
        }
    }
    return "";
}

export function scenarioStringToObject(fileName: string, jsonContent: string): any {
    let importedScenario;
    let body;   
    try {
        body = (typeof(jsonContent) === 'object') ? jsonContent : JSON.parse(jsonContent);
        importedScenario = {
            valid: true,
            message: "",
            severity: -1,
            name: body.name,
            scenario_trigger: body.scenario_trigger,
            description: body.description,
            active: (body.active !== undefined) ? body.active : true,
            code: body.code,
            body: JSON.parse(body.code)
        };

        if (!scenariosValidationModel.validateScenarioId(importedScenario.scenario_trigger)) {
            throw new ScenarioError("Invalid scenario ID");
        }

        const validatorResult = scenariosValidationModel.jsonValidator(importedScenario.body);
        if (validatorResult.errors.length > 0) {
            let message = "Scheme errors found \n ";
            validatorResult.errors.forEach((e) => {
                message += e.message + "\n ";
            });
            throw new ScenarioError(message);
        }
    } catch (err) {
        importedScenario = {
            valid: false,
            message: err.message,
            severity: ScenarioErrorSeverity.error,
            name: fileName,
            scenario_trigger: null,
            description: null,
            active: false,
            code: null,
            body: null,
        };
    }
    return importedScenario;
}

/**
 * Creates a snapshot for given scenario blob
 *
 * @param id scenario id
 * @param account tenant's account
 */
export async function createSnapshot(id: string, account, editor) {
    await tenantContents[account.name].scenarios.createSnapshot(id);
    await updateSnapshotsCount(id, account);
    logSnapshotChange(account.name, "created", editor.emails[0].value, id, undefined);
}

/**
 * Delete snapshot
 *
 * @param id scenario id
 * @param snapshotId  snapshot id (time stamp of snapshot)
 * @param account tenant's account
 */
export async function deleteSnapshot(id: string, snapshotId: string, account, editor) {
    await tenantContents[account.name].scenarios.deleteSnapshot(id, snapshotId);
    await updateSnapshotsCount(id, account);
    logSnapshotChange(account.name, "deleted", editor.emails[0].value, id, snapshotId);
}

/**
 * Copy a snapshot onto the base blob to promote it. Update the update time in the metadata record and reload the scenario in the bot
 *
 * @param id scenatio id
 * @param snapshotId snapshot id
 * @param account tenant's account
 */
export async function copySnapshot(id: string, snapshotId: string, account, editor) {
    const result = await tenantContents[account.name].scenarios.promoteSnapshot(id, snapshotId);
    // Reload the promoted scenario
    const scenario: Scenario = await tenantContents[account.name].scenarios.getScenario(id);
    mainModel.reloadScenario(account.name, scenario.scenario_trigger, scenario.scenario_trigger, scenario.active, scenario.code);

    // Update the last modified date according to the snapshot that was promoted
    const props: BlobGetPropertiesResponse = await tenantContents[account.name].scenarios.getSnapshotProperties(id, snapshotId);
    const updatedScenario: UpdateScenarioParameters = {
        RowKey: id,
        updated: new Date(props.lastModified)
    };
    await tenantContents[account.name].scenarios.updateScenario(updatedScenario);
    logSnapshotChange(account.name, "activated", editor.emails[0].value, id, snapshotId);
    return result;
}

/**
 * 
 * @param id Scenario Id
 * @param snapshotId1 snapshot1 - 
 * @param snapshotId2 snapshot2 - master or snapshot
 * @param account 
 */
export async function getSnapshotAndSnapshotCode(id: string, snapshotId1: string, snapshotId2: string, account: IAccount) {
    const snapshotCode1 = await tenantContents[account.name].scenarios.getSnapshotCode(id, snapshotId1);
    let snapshotCode2;
    if (snapshotId2) {
        snapshotCode2 = await tenantContents[account.name].scenarios.getSnapshotCode(id, snapshotId2);
    }
    else {
        const scenario: Scenario = await tenantContents[account.name].scenarios.getScenario(id);
        snapshotCode2 = {
            returningMessage: scenario.returningMessage,
            breaking: scenario.breaking,
            interrupting: scenario.interrupting,
            version: scenario.code.version,
            steps: scenario.code.steps
        };
    }
    return {
        snapshot1: JSON.stringify(snapshotCode1, undefined, " "),
        snapshot2: JSON.stringify(snapshotCode2, undefined, " ")
    };
}

async function updateSnapshotsCount(id: string, account) {
    // Update scenario metadata
    const snapshots = await tenantContents[account.name].scenarios.getSnapshotsNames(id);
    const updatedScenario: UpdateScenarioParameters = {
        RowKey: id,
        snapshots:  snapshots.length
    };
    await tenantContents[account.name].scenarios.updateScenario(updatedScenario);
}

export const privateFunctions = {};
