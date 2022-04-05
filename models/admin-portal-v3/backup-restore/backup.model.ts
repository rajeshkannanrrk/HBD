import { ILogContext, Logger } from "healthbotcommon/logger";
const logger = Logger.getInstance();
import * as mainModel from "../main.model";
import { BackupImageData } from "../../../definitions/backup-restore/BackupImageData";
import { ResourceFile } from "../../../definitions/backup-restore/ResourceFile";
import { IAccount } from "../../../definitions/Request/Account";
import { IRequestUser } from "../../../definitions/Request/RequestUser";
import * as integrity from "./integrity.model";
import { logBackup } from "../../../services/auditTrailsLogger";
import { tenantContents } from "../../../modules/globals";
import { Scenario } from "healthbotcommon/tenantcontent";

const fs = require("fs");
const path = require("path");
const sanitize = require("sanitize-filename");
const fsExtra = require("fs-extra");

export async function createBackup(account: IAccount, user: IRequestUser, encrypt: boolean, isSystemAdmin: boolean) {
    if (!fs.existsSync('backup')) {
        fs.mkdirSync('backup');
    }
    const logContextObject: ILogContext = {
        logContext: {
            account: {
                name: account.name,
                id: account.id
            },
            action: "backup"
        }
    };
    const backupDir: string = fs.mkdtempSync('backup/' + account.name);
    const backupImageData: BackupImageData = new BackupImageData();
    logger.debug(logContextObject, `[Backup] [${account.name}] Starting backup`);
    await Promise.all([
        backupScenarios(account, backupImageData, logContextObject),
        backupLocalizationData(account, backupImageData, logContextObject),
        backupSpecificConfiguration(account, backupImageData, logContextObject),
        backupDataConnections(account, backupImageData, logContextObject),
        backupAuthenticationProviders(account, backupImageData, logContextObject),
        backupSkills(account, backupImageData, logContextObject),
        backupFiles(account, backupDir, backupImageData, logContextObject)
    ]);

    logger.debug(null, `[Backup] [${account.name}] backup creation completed successfully, cleaning temporary files`);
    try {
        fsExtra.remove(backupDir);
    } catch (e) {
        // TODO: error handling needed
    }

    // if the user is sysadmin - don't log backup
    if (!isSystemAdmin) {
        logBackup(account.name, "saved", user.emails[0].value);
    }

    let result = JSON.stringify(backupImageData, null, 4);
    if (encrypt) {
        logger.debug(null, `[Backup] [${account.name}] encrypting backup file`);
        result = await integrity.encrypt(result);
    }
    return result;
}

async function backupScenarios(account: IAccount, backupImageData: BackupImageData, logContextObject: ILogContext) {
    logger.debug(logContextObject, `[Backup] [${account.name}] backup scenarios started`);
    const scenarios: Scenario[] = await tenantContents[account.name].scenarios.listScenarios();
    backupImageData.scenarios = scenarios.filter((scenario) => scenario.code.steps).map((scenario) => ({
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
        code: {
            interrupting: scenario.interrupting,
            breaking: scenario.breaking,
            returningMessage: scenario.returningMessage,
            version: scenario.code.version,
            steps: scenario.code.steps
        }
    }));
    logger.debug(logContextObject, `[Backup] [${account.name}] backup scenarios ended - ${backupImageData.scenarios.length} scenarios saved`);
}

async function backupLocalizationData(account: IAccount, backupImageData: BackupImageData, logContextObject: ILogContext) {
    logger.debug(logContextObject, `[Backup] [${account.name}] backup localization started`);

    const system = await tenantContents[account.name].localization.system.export();
    const custom = await tenantContents[account.name].localization.custom.export();

    backupImageData.localization = { system, custom };
    logger.debug(logContextObject, `[Backup] [${account.name}] backup localization ended - ${system.length} system strings and ${custom.length} custom strings saved`);
}

async function backupSpecificConfiguration(account: IAccount, backupImageData: BackupImageData, logContextObject: ILogContext) {
    logger.debug(logContextObject, `[Backup] [${account.name}] backup configuration started`);
    backupImageData.configuration = await tenantContents[account.name].config.getOverrides();
    logger.debug(logContextObject, `[Backup] [${account.name}] backup configuration ended`);
}

async function backupDataConnections(account: IAccount, backupImageData: BackupImageData, logContextObject: ILogContext) {
    logger.debug(logContextObject, `[Backup] [${account.name}] backup data connections started`);
    backupImageData.dataConnections = await tenantContents[account.name].dataConnections.getAll();
    logger.debug(logContextObject, `[Backup] [${account.name}] backup data connections ended - ${backupImageData.dataConnections.length} data connections saved`);
}

async function backupAuthenticationProviders(account: IAccount, backupImageData: BackupImageData, logContextObject: ILogContext) {
    logger.debug(logContextObject, `[Backup] [${account.name}] backup authentication providers started`);
    backupImageData.authenticationProviders = await tenantContents[account.name].authProviders.getAll();
    logger.debug(logContextObject, `[Backup] [${account.name}] backup authentication providers ended - ${backupImageData.authenticationProviders.length} authentication providers saved`);
}

async function backupSkills(account: IAccount, backupImageData: BackupImageData, logContextObject: ILogContext) {
    logger.debug(logContextObject, `[Backup] [${account.name}] backup skills started`);
    backupImageData.skills = await tenantContents[account.name].registeredSkillsClient.get();
    logger.debug(logContextObject, `[Backup] [${account.name}] backup skills ended - ${backupImageData.skills.length} skills saved`);
}

async function backupFiles(account: IAccount, backupDir: string, backupImageData: BackupImageData, logContextObject: ILogContext) {
    logger.debug(logContextObject, `[Backup] [${account.name}] backup files started`);
    const blobList = await tenantContents[account.name].resources.getAll();
    backupImageData.files = await Promise.all(blobList.entries.map(async (entry) => {
        const fileName = sanitize(path.basename(entry));
        try {
            await tenantContents[account.name].resources.download(fileName, `${backupDir}/${fileName}`);
            const fileEncoded: string = ResourceFile.encode(`${backupDir}/${fileName}`);
            return { name: fileName, content: fileEncoded };
        }
        catch (e) {
            // do nothing
        }
    }));

    logger.debug(logContextObject, `[Backup] [${account.name}] backup files ended - ${backupImageData.files.length} files saved`);
}
