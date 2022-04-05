import * as azure from 'azure-storage';
import { AzureTableServiceAsync } from 'healthbotcommon/azurestorageasync/azuretableserviceasync';
import * as config from 'config';
import * as mainModel from '../admin-portal-v3/main.model';
import { KeyVault } from "healthbotcommon/keyvault";
import { tableProperties } from "healthbotcommon/analytics/filteredTables";
import { HealthBotUtils} from "healthbotcommon/healthbotutils";
import { Logger } from "healthbotcommon/logger";
import { tenants, tenantContents } from '../../modules/globals';
const rp = require('request-promise');

const kv = KeyVault.getInstance();
const logger = Logger.getInstance();

export async function getData(table: string): Promise<Array<Record<string, any>>> {
    const query: azure.TableQuery = new azure.TableQuery().select(tableProperties[`${table}`].fields as string[]);
    const entities: Array<Record<string, any>> = [];
    let continuationToken: azure.TableService.TableContinuationToken = null;

    do {
        const tableService: AzureTableServiceAsync =
            tableProperties[`${table}`].type === 'cosmos' ? mainModel.tenantCosmosTableService :
                tableProperties[`${table}`].type === 'global-cosmos' ? mainModel.globalCosmosTableService :
                    mainModel.tenantStorageTableService;
        const response: { continuationToken: azure.TableService.TableContinuationToken; value: any[] } = await tableService.queryEntitiesWithContinuationToken(table, query, continuationToken);
        continuationToken = response.continuationToken;
        response.value.forEach(((entity) => {
            entity._region = config.get('azure_healthbot.resource_region');
            entities.push(entity);
        }));
        await HealthBotUtils.sleep(2000);
    } while (continuationToken);

    if (tableProperties[table].getFromIsolatedStorage) {
        const isolatedTenants = Object
            .keys(tenants)
            .filter((tenantName) => tenants[tenantName].storageModelVersion === "2");

        /*
        https://dev.azure.com/mshealthil/HealthIL/_queries/edit/9874
        this is a temporary array to ignore broken CMK tenants.
        the array and relevant code should be removed once the open issue with Azure storage is resolved
         */
        const brokenTenantsNames = ['guy-check-msi-tagz8wz', 'test-cmk-arie-sub-fdo4yn3'];

        for (const tenantName of isolatedTenants) {
            if (brokenTenantsNames.includes(tenantName)) {
                logger.warning(null, 'reports::getData: Skipping broken tenant: ' + tenantName);
            }
            else {
                try {
                    const entitiesToAdd = await tableProperties[table].getFromIsolatedStorage(tenantContents[tenantName]);

                    entities.push(...entitiesToAdd.map((entity) => ({ ...entity, _region: config.get('azure_healthbot.resource_region') })));
                } catch (err) {
                    logger.error(null, `Failed fetching ${table} data for tenant ${tenantName}: ${JSON.stringify(err)}`);

                    if (!isKeyVaultEncryptionKeyNotFoundError(err) && !isEncryptionScopeNotAvailableError(err)) {
                        throw err;
                    }
                }
            }
        }
    }

    return entities;
}

function isKeyVaultEncryptionKeyNotFoundError(err: any): boolean {
    return err.statusCode === 403 && err.details?.odataError?.code === "KeyVaultEncryptionKeyNotFound";
}

function isEncryptionScopeNotAvailableError(err: any): boolean {
    return err.statusCode === 409 && err.details?.odataError?.code === "EncryptionScopeNotAvailable";
}

export async function getGlobalBlobData(container: string, blobId: string): Promise<any> {
    let blobText = await mainModel.globalBlobService.getBlobToText(container, blobId);
    return blobText;
}


//TODO: move this to common and merge with the code on Healthbot:metering:1063?
export async function queryAppInsight(query: any): Promise<Array<Record<string, any>>> {

    const secret = (await kv.getSecret("dashboardreportsapikey"));
    const appId = config.get("application_insights.bot_application_id");

    // query appinsight
    const options = {
        uri: "https://api.applicationinsights.io/v1/apps/" + appId + "/query",
        qs: { ...query },
        headers: { "x-api-key": secret, "Prefer": "wait=600" },
        json: true
    };
    let result = await rp(options);

    // add region column
    const region = config.get('azure_healthbot.resource_region');

    //app insight api will return "success" result with error on partial result
    if (result.error) {
        throw new Error(`Error in region ${region}. error: ${result.error.message}`);
    }

    result.tables.forEach(tabel => {
        tabel.columns.push({
            name: "_region",
            type: "string"
        })
        tabel.rows.forEach(row => {
            row.push(region)
        });
    });

    return result;
}