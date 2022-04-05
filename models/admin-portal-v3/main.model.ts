import * as config from 'config';
import { AzureBlobServiceAsync } from "healthbotcommon/azurestorageasync/azureblobserviceasync";
import { AzureTableServiceAsync } from "healthbotcommon/azurestorageasync/azuretableserviceasync";
import { TenantDeletionStatus } from "healthbotcommon/enums";
import { UserRole } from "../../modules/auth";
import { Logger } from 'healthbotcommon/logger';
import * as portalFeedback from '../admin-portal-v3/portal-feedbacks.model';
import { eventTypes, portalActions } from '../../logging';
const moment = require('moment');
const logger = Logger.getInstance();
export let pjson;

export let blobService: AzureBlobServiceAsync;
export let feedbackBlobService;
export let feedbackContainerNameStr;
export let tenantStorageTableService: AzureTableServiceAsync;
export let tenantCosmosTableService;
export let botTableService;
export let kvService;
export let io;

export let sendEventToPortal;
export let reloadTenant;
export let sendErrToClient;
export let reloadLocalizationStrings;
export let updateLocalizationSettings;
export let reloadScenario;
export let reloadDataConnections;
export let removeTenant;
export let adminBlobService: AzureBlobServiceAsync;
export let globalBlobService: AzureBlobServiceAsync;
export let globalCosmosTableService: AzureTableServiceAsync;

export async function init(pjsonObject, blobSvc, tenantStorageTableSvc, tenantCosmosTableSvc, botTableSvc, adminBlobSvc: AzureBlobServiceAsync, globalBlobSvc: AzureBlobServiceAsync, globalCosmosTableSvc: AzureTableServiceAsync, kvSvc, reloadTenantFunction, sendErrToClientFunction, reloadScenarioFunction, reloadDataConnectionsFunction,
                           feedbackBlobSvc, feedbackContainerName, reloadLocalizationStringsFunction, updateLocalizationSettingsFunction,
                           removeTenantFunction, sendEventToPortalFunction) {
    pjson = pjsonObject;

    blobService = blobSvc;
    feedbackBlobService = feedbackBlobSvc;
    feedbackContainerNameStr = feedbackContainerName;
    tenantStorageTableService = tenantStorageTableSvc;
    tenantCosmosTableService = tenantCosmosTableSvc;
    botTableService = botTableSvc;
    adminBlobService = adminBlobSvc;
    globalBlobService = globalBlobSvc;
    globalCosmosTableService = globalCosmosTableSvc;
    kvService = kvSvc;

    sendEventToPortal = sendEventToPortalFunction;
    reloadTenant = reloadTenantFunction;
    sendErrToClient = sendErrToClientFunction;
    reloadScenario = reloadScenarioFunction;
    reloadDataConnections = reloadDataConnectionsFunction;
    reloadLocalizationStrings = reloadLocalizationStringsFunction;
    updateLocalizationSettings = updateLocalizationSettingsFunction;
    removeTenant = removeTenantFunction;

    await tenantCosmosTableService.createTableIfNotExists('skills');
    await tenantCosmosTableService.createTableIfNotExists("systemLocalizedStrings");
    await tenantCosmosTableService.createTableIfNotExists("customLocalizedStrings");
    await tenantCosmosTableService.createTableIfNotExists("localizationSettings");
    await tenantCosmosTableService.createTableIfNotExists("dataConnections");
    await tenantCosmosTableService.createTableIfNotExists("authenticationProviders");
    await tenantCosmosTableService.createTableIfNotExists("deletedTenants");
    await tenantCosmosTableService.createTableIfNotExists("skillsInfo");
    await tenantCosmosTableService.createTableIfNotExists("tenants");
    await tenantCosmosTableService.createTableIfNotExists("scenarios");
    await tenantCosmosTableService.createTableIfNotExists("users");
    await tenantCosmosTableService.createTableIfNotExists(portalFeedback.PORTAL_FEEDBACKS_TABLE_NAME);
    
    await tenantStorageTableService.createTableIfNotExists("auditTrails");
    await tenantStorageTableService.createTableIfNotExists("auditTrailsV2");
    await tenantStorageTableService.createTableIfNotExists("misunderstood");
    await portalFeedback.init(kvService);    
}

export function registerSocketIO(ioSvc) {
    io = ioSvc;
}

export function isScenarioSearchAvailable() {
    return !!config.get("search_server_url");
}

export async function getData(req) {

    let buildVersion;
    try {
        const split = pjson.build.split("_");
        buildVersion = split.length === 2 ? "Local development version" : "Health Bot portal v3." + split[0] + " - " + moment(split[2] + " ").format("MMM DD, YYYY");
    }
    catch (e) {
        buildVersion = pjson.build;
    }
    logger.analyticsEvent(eventTypes.PORTAL_ACTION, {
        logContext: {
            region: config.get('azure_healthbot.resource_region'),
            tenantId: req.account.id,
            tenantName: req.account.name,
            action: portalActions.PAGE_VIEW,
            target: req.baseUrl,
        }
    });
    return {
        version: pjson.version,
        description: pjson.description,
        build: pjson.build,
        build_version: buildVersion,
        friendly_name: (req.account.friendly_name === undefined || req.account.friendly_name.length === 0) ? req.account.name : req.account.friendly_name,
        tenantId: req.account.id,
        tenantName: req.account.name,
        resourcesUrl: this.blobService.getUrl("resources") + "/" + req.account.name,
        user_management: req.account.usermanagement || 'windowslive',
        user: {
            displayName: req.user.displayName,
            email: req.user.emails[0].value,
            initials: getUserInitials(req.user.displayName),
            sessionCode: req.user.sessionCode
        },
        isSysAdmin: req.userRole >= UserRole.SystemAdmin,
        isAdmin: req.userRole >= UserRole.Admin,
        isEditor: req.userRole >= UserRole.Editor,
        isReader: req.userRole >= UserRole.Reader,
        isCSS: req.userRole === UserRole.CSS,
        isDeletionStatusLimited: req.account.deletionStatus === TenantDeletionStatus.LIMITED,
        accessExpirationDate: req.account.lastModifiedDeletionStatus ? moment(req.account.lastModifiedDeletionStatus).add(config.get("data_retention.limited_account_period_days"), 'days').format('llll') : undefined,
        accountName: req.account.name,
        evalExpired : req.account.endsAt && moment(req.account.endsAt).diff(moment(), 'days') < 0,
        evalExpires: req.account.endsAt ? moment(req.account.endsAt).format('MMM-DD-YYYY') : undefined,
        navigationPath: req._navigation_path,
        powerbi_report: req.account.powerbi_report || "",
        scenario: null,
        returningMessage: null,
        socketioRoomName: req.account.id,
        adminPortalBaseUrl: config.get('onboarding.baseUrl'),
        azureResourceId: req.account.azureResourceId,
        azureResourceLink: req.account.azureResourceId ? config.get('azure_healthbot.portal_url') + '#@' + req.account.aadTenantId + `/resource${req.account.azureResourceId}/overview` : undefined,
        systemPortalBaseUrl: config.get('system_portal.baseUrl'),
        directlineDomain: config.get('bot_connector.directline_domain'),
        app_id: req.account.app_id,
        botName: req.account.botName,
        armGroup: req.account.armGroup,
        subscriptionId: req.account.subscriptionId,
        forceDisableTriagePossibleCauses: config.get('infermedica.force_disable_triage_possible_causes'),
        scenarioSearchAvailable: isScenarioSearchAvailable()
    };
}

function getUserInitials(displayName) {
    if (displayName === undefined || displayName === null || displayName.length === 0) {
        return null;
    }
    const split = displayName.split(" ").map((text) => text.trim()).filter((text) => text.length > 0);
    if (split.length === 0) {
        return null;
    }
    else if (split.length === 1) {
        return split[0].substring(0, 2).toUpperCase();
    }
    else {
        return split[0].substring(0, 1).toUpperCase() + split[1].substring(0, 1).toUpperCase();
    }
}

export async function getPlanDetails(account) {
    const response = await tenantCosmosTableService.retrieveEntity('tenants', "tenants", account.id);
    const planId = response.planId;
    const planType = response.planType;
    const usage = response.monthlyReportedUsage ? JSON.parse(response.monthlyReportedUsage) : undefined;
    const msgCount = usage ? usage[planId].messages : response.msgCount || 0;
    const maxMessages = response.maxMessages;
    const medicalEncounters = usage ? usage[planId].mcus : response.medicalEncounters;
    const isConsumptionPlan = (planType === 'consumption');
    const maxMCUs = response.maxFreeMCUs;
    let mcuPrice = 0;
    let messagePrice = 0;
    if (isConsumptionPlan) {
        const planInfo: any = config.get('marketplace.consumptionPlans.' + planId);
        mcuPrice = planInfo.mcuPrice;
        messagePrice = planInfo.msgPrice;
    }
    return { planId, planType, msgCount, maxMessages, medicalEncounters, maxMCUs, isConsumptionPlan, mcuPrice, messagePrice };
}

export async function pageNotFound(req, res, error = "The page you requested does not exist") {
    return res.render('admin-portal-v3/error', {error, accountName: req.account ? req.account.name : false});
}
export const privateFunctions = {};
