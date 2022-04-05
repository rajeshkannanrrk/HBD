import * as azure from 'azure-storage';
import { HashingUtils } from 'healthbotcommon/healthbotutils';
import * as mainModel from '../main.model';

export async function generateApiKey(accountId: string, accountName: string) {
    const apiKey: string = HashingUtils.getRandomHexString(32);
    const entGen = azure.TableUtilities.entityGenerator;
    const updateTenant = {
        PartitionKey: 'tenants',
        RowKey: entGen.String(accountId),
        api_jwt_secret: apiKey,
    };

    await mainModel.tenantCosmosTableService.mergeEntity('tenants', updateTenant);
    mainModel.reloadTenant(accountName);

    return apiKey;
}
