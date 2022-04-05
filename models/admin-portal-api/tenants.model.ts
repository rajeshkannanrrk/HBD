import { TableQuery } from 'azure-storage';
import {Logger} from 'healthbotcommon/logger';
const logger = Logger.getInstance();
import { TenantDeletionStatus } from "healthbotcommon/enums";
import moment = require('moment');
import * as subscriptionHandlers from "../../modules/subscriptionHandlers";
import * as mainModel from '../admin-portal-v3/main.model';
import { eventTypes } from '../../logging';

const config = require('config');
const rp = require('request-promise');
const _ = require('underscore');
const uuid = require('node-uuid');
const azure = require('azure-storage');
const globals = require('../../modules/globals');
import * as redisManager from '../../modules/redisManager';
import { tenantContents } from '../../modules/globals';

export async function getAll(filter = '') {

    const query =  (filter && filter !== '') ? new azure.TableQuery().where('name ge ? and name lt ?', filter, 
        filter.slice(0, -1) + String.fromCharCode(filter.slice(-1).charCodeAt(0) + 1)) : 
        new azure.TableQuery();

    let continuationToken = null;
    const tenants = [];
    logger.debug(null, "reading all data...");
    do {
        const response = await mainModel.tenantCosmosTableService.queryEntitiesWithContinuationToken('tenants', query, continuationToken);
        continuationToken = response.continuationToken;
        for (const item of response.value) {
            tenants.push(item);
        }
    } while (continuationToken);

    const data = {
        blobUrl: mainModel.blobService.getUrl("resources"),
        tenants
    };

    tenants.forEach((tenant) => {
        if (!tenant.usermanagement) {
            tenant.usermanagement = "portal";
        }
        if (!tenant.tenantid) {
            tenant.tenantid = "";
        }
        if (!tenant.domains) {
            tenant.domains = "";
        }
    });
    return data;
}

export function add() {
    return { logo: '', logoUrl: '', usermanagement: 'portal'};
}

export async function save(tenant): Promise<string> {
    const newTenant =  tenant.id.length === 0;
    const key = newTenant ?  uuid.v4() : tenant.id;
    if (newTenant && globals.tenants[tenant.name]){
        throw new Error("tenant name is already in use");
    }
    const entGen = azure.TableUtilities.entityGenerator;
    if (newTenant) {
        const updatedTenant = {
            PartitionKey: entGen.String('tenants'),
            RowKey: entGen.String(key),
            name: entGen.String(tenant.name),
            friendly_name: entGen.String(tenant.friendly_name),
            app_id: entGen.String(tenant.app_id),
            app_secret: entGen.String(tenant.app_secret),
            email: entGen.String(tenant.email),
            webchat_secret: entGen.String(tenant.webchat_secret),
            usermanagement: entGen.String(tenant.usermanagement || "portal"),
            tenantid: entGen.String(tenant.tenantid || ""),
            armGroup: entGen.String(tenant.armGroup || ""),
            subscriptionId: entGen.String(tenant.subscriptionId || ""),
            botName: entGen.String(tenant.botName || ""),
            saasSubscriptionId: entGen.String(tenant.saasSubscriptionId),
            planId: entGen.String(tenant.planId) || "",
            offerId: entGen.String(tenant.offerId) || "",
            domains: entGen.String(tenant.domains || ""),
            maxMessages: entGen.Int32(tenant.maxMessages),
            maxFreeMCUs: entGen.Double(tenant.maxFreeMCUs),
            planType: entGen.String(tenant.planType) || "",
            medicalEncounters: entGen.Double(tenant.medicalEncounters),
            endsAt: tenant.endsAt ? entGen.DateTime(tenant.endsAt) : undefined,
            created: entGen.DateTime(moment.utc().toDate()),
            api_jwt_secret: entGen.String(tenant.api_jwt_secret),
            azureResourceId: entGen.String(tenant.azureResourceId),
            aadTenantId: entGen.String(tenant.aadTenantId),
            lastMarketplaceConsumptionUpdated: (tenant.planType === 'consumption' && tenant.offerId === 'microsofthealthcarebot') ? entGen.DateTime(new Date()) : undefined,
            azureTags: entGen.String(tenant.tags),
            storageModelVersion: entGen.String(tenant.storageModelVersion)
        };
        await mainModel.tenantCosmosTableService.insertOrReplaceEntity("tenants", updatedTenant);
        
        logger.analyticsEvent(eventTypes.TENANT_ADDED, {
            logContext: {
                region: config.get('azure_healthbot.resource_region'),
                tenantId: tenant.RowKey,
                tenantName: tenant.name,
            }
        });

        // add new user
        const user = {
            RowKey: entGen.String(uuid.v4()),
            PartitionKey: entGen.String(key),
            email: entGen.String(tenant.email),
            isAdmin: entGen.Boolean(true)
        };
        await mainModel.tenantCosmosTableService.insertOrReplaceEntity("users", user);
        logger.debug(null, "new user added for new tenant " + tenant.email);
    }
    else {
        tenant.PartitionKey = 'tenants';
        tenant.RowKey = tenant.id;
        delete tenant.id;
        await mainModel.tenantCosmosTableService.mergeEntity("tenants", tenant);
        logger.debug(null, `Updated tenant ${tenant.name}`);
    }
    const tenantRow = await mainModel.tenantCosmosTableService.retrieveEntity('tenants', 'tenants', key);
    // update tenant details in this app
    tenantRow.id = tenantRow.RowKey;
    await mainModel.sendEventToPortal(tenantRow, subscriptionHandlers.EventsNames.saveTenant);
    await mainModel.sendEventToPortal({tenantId: key}, subscriptionHandlers.EventsNames.loadTenantUsers);
    mainModel.reloadTenant(tenantRow.name, tenantRow);  // this call sends reload tenant event to bot
    return tenantRow.RowKey;
}

export async function getOne(id: string): Promise<any> {
    try {
        const tenantRow = await mainModel.tenantCosmosTableService.retrieveEntity('tenants', 'tenants', id);
        return tenantRow;    
    }
    catch (error) {
        return undefined;
    }
}

export async function getTenantByName(name: string): Promise<any> {
    try {
        const query = new azure.TableQuery().where("name eq ?", name);
        const tenants = await mainModel.tenantCosmosTableService.queryEntities('tenants', query, null);
        if (tenants.length === 1) {
            return tenants[0];
        }
        return undefined;    
    }
    catch (error) {
        return undefined;
    }
}

/**
 * Increments Azure HealthBot tenants counter cache in Redis if exists (If not exists, does nothing).
 *
 * @return - A promise resolved when increment is complete.
 */
export async function incrementAzureHealthBotTenantsCounter(): Promise<void> {
    const tenantsCounterAsString: string = await redisManager.handyRedisClient.get(`tenant_count`);
    if (tenantsCounterAsString) { // If value exists - increment it. Else, leave it empty (will be calculated when needed).
        await redisManager.handyRedisClient.set(`tenant_count`, String(Number(tenantsCounterAsString) + 1));
    }
}

/**
 * Counts the number of Azure HealthBot tenants (deleted and non-deleted). Takes number from cache (Redis) if available.
 *
 * @return - A promise resolved with the number of tenants (in the current region).
 */
export async function countAzureHealthBotTenants(): Promise<number> {
    let res = 0;
    const numberOfBotsAsString: string = await redisManager.handyRedisClient.get(`tenant_count`); // Try to get number of tenants from cache (Redis).
    if (!numberOfBotsAsString) { // If value is not available in Redis, query the tenants tables.
        const query =  new azure.TableQuery().where("offerId eq ?", "azurehealthbot"); // Count only Azure HealthBots.
        let continuationToken: any = null;
        logger.debug(null, "reading all non-deleted tenants...");
        do {
            const response = await mainModel.tenantCosmosTableService.queryEntitiesWithContinuationToken('tenants', query, continuationToken);
            continuationToken = response.continuationToken;
            for (const item of response.value) {
                res++;
            }
        } while (continuationToken);
        logger.debug(null, "reading all deleted tenants...");
        do {
            const response = await mainModel.tenantCosmosTableService.queryEntitiesWithContinuationToken('deletedTenants', query, continuationToken);
            continuationToken = response.continuationToken;
            for (const item of response.value) {
                res++;
            }
        } while (continuationToken);
        logger.info(null, `Number of tenants in region based on tenants table query ${res}`);
        await redisManager.handyRedisClient.set(`tenant_count`, String(res));
    }
    else {
        res = Number(numberOfBotsAsString);
        logger.info(null, `Number of tenants in region based on cache in Redis ${res}`);
    }
    return res;
}

/**
 * Get all tenants that are owned/co-owned by the given email
 *
 * @param email 
 */
export async function getByOwner(email: string): Promise<any[]> {
    let continuationToken = null;
    let ownedTenants = [];
    do {
        const result = await mainModel.tenantCosmosTableService.queryEntitiesWithContinuationToken('tenants', undefined, continuationToken);
        // Look in comma separated list of email, ignoring leading/trailing white-spaces and upper/lower cases
        const tenants = _.filter(result.value, (t) => {
            const owners = t.email.split(';');
            return (_.findIndex(owners, (o) => o.trim().toLowerCase() === email) >= 0);
        });
        ownedTenants = _.union(ownedTenants, tenants);
        continuationToken = result.continuationToken;
    } while (continuationToken);
    return ownedTenants;
}

export async function getOneBySaasSubscriptionId(id: string): Promise<any> {
    try {
        const query = new azure.TableQuery().where("saasSubscriptionId eq ?", id);
        const tenants = await mainModel.tenantCosmosTableService.queryEntities('tenants', query, null);
        if (tenants.length === 1) {
            return tenants[0];
        }
        return undefined;    
    }
    catch (error) {
        return undefined;
    }
}

export async function startTenantDeletionSequence(name: string) {
    logger.info(null, `startTenantDeletionSequence:: getting tenant entity for ${name}`);
    const tenant = await getTenantByName(name);
    if (tenant) {
        if (tenant.deletionStatus){
            logger.info(null, `startTenantDeletionSequence:: Tenant ${name} is already in deletion sequence: ${tenant.deletionStatus}`);
            return {status: 200, message: `Tenant ${name} is already in deletion sequence`};
        }
        const timestamp = moment.utc();
        const entGen = azure.TableUtilities.entityGenerator;

        logger.info(null, `startTenantDeletionSequence:: updating tenant ${name} entity with LIMITED deletionStatus`);
        try{
            await mainModel.tenantCosmosTableService.mergeEntity('tenants', {
                PartitionKey: entGen.String(tenant.PartitionKey),
                RowKey: entGen.String(tenant.RowKey),
                deletionStatus: entGen.String(TenantDeletionStatus.LIMITED),
                lastModifiedDeletionStatus: entGen.DateTime(timestamp.toDate())
            });
        }catch (err){
            logger.error(null, `startTenantDeletionSequence:: Failed to merge deletionStatus to tenant entity`, err);
            return {status: 500};
        }

        const deletionProperties = {
            deletionStatus: TenantDeletionStatus.LIMITED,
            lastModifiedDeletionStatus: timestamp.format(),
        };

        logger.info(null, `startTenantDeletionSequence:: notifying bot and portal for ${name}`);
        try{
            await mainModel.sendEventToPortal({name: tenant.name, ...deletionProperties}, subscriptionHandlers.EventsNames.updateTenant);
            mainModel.reloadTenant(tenant.name, tenant);
        }catch (err){
            logger.error(null, `startTenantDeletionSequence:: Failed to notify portals and/or bots with the new deletionStatus`, err);
        }

        logger.info(null, `startTenantDeletionSequence:: log analytics event for ${name}`);
        try {
            logger.analyticsEvent(eventTypes.TENANT_DELETED, {
                logContext: {
                    region: config.get('azure_healthbot.resource_region'),
                    tenantId: tenant.RowKey,
                    tenantName: tenant.name,
                }
            });
        } catch (err) {
            logger.error(null, `startTenantDeletionSequence:: Failed to log tenant deletion analytics event`, err);
        }

        return {status: 200, message: `Deletion sequence for tenant ${tenant.name} has successfully started`} ;
    }
    else {
        logger.error(null, `startTenantDeletionSequence:: Tenant ${name} not found`);
        return {status: 404};
    }
}

export async function updateTenant(name: string , data: any) {

    const tenant = await getTenantByName(name);
    if (tenant) {
        const entGen = azure.TableUtilities.entityGenerator;
        const newTenant: {[key: string]: any} = {
            PartitionKey: "tenants",
            RowKey: entGen.String(tenant.RowKey),
            friendly_name: entGen.String(data.displayName),
            usermanagement: entGen.String(data.usermanagement),
            tenantid: entGen.String(data.tenantid),
            planId: entGen.String(data.planId), 
            maxMessages: entGen.Int32(data.maxMessages),
            msgCount: entGen.Int32(data.msgCount),
            maxFreeMCUs: entGen.Double(data.maxFreeMCUs),
            medicalEncounters: entGen.Double(tenant.medicalEncounters),
            planType: entGen.String(data.planType),
            email: entGen.String(data.email),
            offerId: entGen.String(data.offerId),
            azureResourceId: entGen.String(data.azureResourceId),
            aadTenantId: entGen.String(data.aadTenantId),
            lastMarketplaceConsumptionUpdated: (tenant.planType === 'consumption' && tenant.offerId === 'microsofthealthcarebot') ? entGen.DateTime(new Date()) : undefined,
            azureTags: entGen.String(data.tags)
        };
        // If moving to the consumption plan, set the reported counters to current counters
        // So the tenant will not be charged twice for the messages from the beginning of the month
        if (data.planType === 'consumption' && data.planType !== tenant.planType) {
            if (tenant.msgCount >  data.maxMessages) {
                newTenant.reportedMsgCount = entGen.Int32(tenant.msgCount);
            }
            if (tenant.medicalEncounters > data.maxFreeMCUs) {
                newTenant.reportedMCUs = entGen.Double(tenant.medicalEncounters);          
            }
        }
        await mainModel.tenantCosmosTableService.mergeEntity('tenants', newTenant);
        newTenant.name = tenant.name;
        const tenantRow = await mainModel.tenantCosmosTableService.retrieveEntity('tenants', 'tenants', tenant.RowKey);
        tenantRow.id = tenantRow.RowKey;
        // check if we are updating tenant's Tier / Plan
        if (data.planId !== tenant.planId) {
            logger.analyticsEvent(eventTypes.TENANT_TIER_CHANGE, { 
                logContext: {
                    region: config.get('azure_healthbot.resource_region'),
                    tenantId: tenant.RowKey,
                    tenantName: name,
                    oldTier: tenant.planId,
                    newTier: data.planId,
                }
            });
        }
        await mainModel.sendEventToPortal(tenantRow, subscriptionHandlers.EventsNames.updateTenant);
    }
    return tenant;
}

export async function getTenantConfigurations(): Promise<any> {
    const tenants = [];

    let continuationToken = null;

    do {
        const response = await mainModel.tenantCosmosTableService.queryEntitiesWithContinuationToken('tenants', new TableQuery().select("name"), continuationToken);

        continuationToken = response.continuationToken;

        const tenantsToAdd = await Promise.all(response.value.map(async ({ name }) => ({
            name,
            config: await tenantContents[name].config.getOverrides().catch(() => ({}))
        })));
        
        tenants.push(...tenantsToAdd);
    } while (continuationToken);

    return { scheme: await tenantContents[Object.keys(tenantContents)[0]].config.getSchema(), tenants };
}

export async function getScenariosBySearchTerm(term: string): Promise<any> {
    if (!mainModel.isScenarioSearchAvailable()) {
        return { value: [] };
    }
    
    const scenariosSearchApiKey: string = await mainModel.kvService.getSecret('scenariossearchapikey');
    const options = {
        method: 'GET',
        url: `${config.get("search_server_url")}&search=${term}&highlightPreTag=<span class='search-scenario-match'>&highlightPostTag=</span>&highlight=content&$count=true`,
        headers: {
            'api-key': scenariosSearchApiKey
        }
    };
    const response = await rp(options);
    return response;
}

const privateFunctions = {};

if (process.env.NODE_UNITTEST === 'true') {
    module.exports.privateFunctions = privateFunctions;
}
