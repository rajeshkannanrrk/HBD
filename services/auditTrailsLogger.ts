import { Logger } from "healthbotcommon/logger";
import { IFxAuditEventCategory, IFxAuditIdentityType, IFxAuditResultType } from "healthbotcommon/enums";
import * as globals from "../modules/globals";
import { AuditTrailActionType, AuditTrailItemType } from "healthbotcommon/tenantcontent";
import * as config from "config";

const logger = Logger.getInstance();

async function logAuditTrail(tenantName: string, itemType: AuditTrailItemType, actionType: AuditTrailActionType, editor: string, data: Record<string, any>) {
    await globals.tenantContents[tenantName].auditTrails.log(itemType, actionType, editor, data);
    logger.audit(`AuditTrail - ${actionType}`, IFxAuditResultType.Success, IFxAuditEventCategory.applicationManagement, IFxAuditIdentityType.Username, [tenantName, editor, config.get('azure_healthbot.resource_region')], 'ManagementPortalResource', itemType, data);
    logger.debug(null, "audit trail saved");
}

export async function logLanguageModelsChange(tenantName: string, actionType: AuditTrailActionType, editor: string, modelName: string) {
    await logAuditTrail(tenantName, "language_models", actionType, editor, { modelName }).catch((err) => logger.error(null, err));
}

export async function logLocalizationChange(tenantName: string, actionType: AuditTrailActionType, editor: string, localizationType: string) {
    await logAuditTrail(tenantName, "localization", actionType, editor, { localizationType }).catch((err) => logger.error(null, err));
}

export async function logScenarioChange(tenantName: string, actionType: AuditTrailActionType, editor: string, scenarioName: string, scenarioTrigger: string) {
    await logAuditTrail(tenantName, "scenarios", actionType, editor, {scenarioName, scenarioTrigger}).catch((err) => logger.error(null, err));
}

export async function logConversationLogsDataExported(tenantName: string, editor: string, StartDate: string, EndDate: string, UserId: string) {
    await logAuditTrail(tenantName, "conversation_logs", "exported", editor, {StartDate, EndDate, UserId}).catch((err) => logger.error(null, err));
}

export async function logNewConfigurationChange(tenantName: string, editor: string, section: string) {
    await logAuditTrail(tenantName, "configuration", "modified", editor, {section}).catch((err) => logger.error(null, err));
}

export async function logUserChange(tenantName: string, actionType: AuditTrailActionType, editor: string, username: string, userrole: number) {
    await logAuditTrail(tenantName, "users", actionType, editor, {username, userrole}).catch((err) => logger.error(null, err));
}

export async function logSnapshotChange(tenantName: string, actionType: AuditTrailActionType, editor: string, scenarioId: string, snapshotId: string) {
    await logAuditTrail(tenantName, "snapshots", actionType, editor, {scenarioId, snapshotId}).catch((err) => logger.error(null, err));
}

export async function logBackup(tenantName: string, actionType: AuditTrailActionType, editor: string) {
    await logAuditTrail(tenantName, "backup", actionType, editor, {action: actionType === "saved" ? "Backup saved" : "Backup imported"}).catch((err) => logger.error(null, err));
}

export async function logChannelChange(tenantName: string, actionType: AuditTrailActionType, editor: string, channelName: string) {
    await logAuditTrail(tenantName, "channels", actionType, editor, {channelName}).catch((err) => logger.error(null, err));
}

export async function logBotIconChange(tenantName: string, actionType: AuditTrailActionType, editor: string, iconName: string) {
    await logAuditTrail(tenantName, "icon", actionType, editor, {iconName}).catch((err) => logger.error(null, err));
}

export async function logTenantAccountChangeWithThrowing(tenantName: string, actionType: AuditTrailActionType, editor: string, changes: Record<string, any>) {
    await logAuditTrail(tenantName, "account", actionType, editor, changes);
}

export async function logTenantAccountChangeWithoutThrowing(tenantName: string, actionType: AuditTrailActionType, editor: string, changes: Record<string, any>) {
    await logAuditTrail(tenantName, "account", actionType, editor, changes).catch((err) => logger.error(null, err));
}

export async function logDataRetentionChange(tenantName: string, editor: string, retentionPeriod: number) {
    await logAuditTrail(tenantName, "conversation_logs", "modified", editor, {retentionPeriod}).catch((err) => logger.error(null, err));
}

export async function logSkillsChange(tenantName: string, actionType: AuditTrailActionType, editor: string, data: Record<string, any>) {
    await logAuditTrail(tenantName, "skills", actionType, editor, data).catch((err) => logger.error(null, err));
}
