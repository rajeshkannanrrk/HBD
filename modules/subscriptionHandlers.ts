import * as config from "config";
import { Logger } from "healthbotcommon/logger";
import { tenantContentClientFactory, Config as TenantContentClientConfig } from "healthbotcommon/tenantcontent";
import { KeyVault } from "healthbotcommon/keyvault";
import * as globals from "./globals";
import * as auth from "./auth";

const logger = Logger.getInstance();
const kv = KeyVault.getInstance();

export enum EventsNames {
    deleteTenant,
    saveTenant,
    updateTenant,
    loadTenantUsers,
}

export const deleteTenantHandler = (body: string) => {
    try {
        const tenant = JSON.parse(body);
        delete globals.tenants[tenant.name];
        logger.debug(null, `deleteTenant event has been handled for tenant ${tenant.name}`);
    } catch (error) {
        logger.error(null, `error '${error}' when trying to delete tenant's cache locally: ${body}`);
    }
};

export const saveTenantHandler = async (body: string): Promise<void> => {
    try {
        const [tenantSasToken, tenantV2SasToken, botSasToken, cosmosSecret] = await Promise.all([
            kv.getSecret(config.get('azure_storage.sas_token_name')),
            kv.getSecret(config.get("tenant_storage_v2.sas_token_name")),
            kv.getSecret(config.get('inner_bot_storage.sas_token_name')),
            kv.getSecret(config.get('azure_storage.cosmos_table_secret_name'))
        ]);

        const tenant = JSON.parse(body);
        const clientConfig: TenantContentClientConfig = {
            tenantAsa: { name: config.get("azure_storage.account_name"), sasToken: tenantSasToken },
            tenantAsaV2: { name: config.get("tenant_storage_v2.account_name"), sasToken: tenantV2SasToken },
            botAsa: { name: config.get("inner_bot_storage.account_name"), sasToken: botSasToken },
            cosmosAccount: { accountName: config.get('azure_storage.cosmos_table_account_name'), accountKey: cosmosSecret }
        };

        globals.tenants[tenant.name] = tenant;
        globals.tenantContents[tenant.name] = tenantContentClientFactory(tenant, clientConfig);

        await globals.tenantContents[tenant.name].init();
        logger.debug(null, `saveTenant event has been handled for tenant ${tenant.name}`);
    } catch (error) {
        logger.error(null, `error '${error}' when trying to save tenant's cache locally: ${body}`);
    }
};

export const updateTenantHandler = (body: string) => {
    try {
        const tenant = JSON.parse(body);
        globals.tenants[tenant.name] = {...globals.tenants[tenant.name], ...tenant};
        logger.debug(null, `updateTenant event has been handled for tenant ${tenant.name}`);
    } catch (error) {
        logger.error(null, `error '${error}' when trying to update tenant's cache locally: ${body}`);
    }
};

export const loadTenantUsersHandler = async (body: string) => {
    try {
        const tenantId = JSON.parse(body).tenantId;
        await auth.loadTenantUsersAsync(tenantId);
        logger.debug(null, `loadTenantUsers event has been handled for tenant ${tenantId}`);
    } catch (error) {
        logger.error(null, `error '${error}' when trying to load tenant's users to local cache: ${body}`);
    }
};
