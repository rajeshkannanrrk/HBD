import ResourceManagementClient from "azure-arm-resource/lib/resource/resourceManagementClient";
import { Logger } from 'healthbotcommon/logger';
import * as msrestAzure from 'ms-rest-azure';
import { IAccount } from "../../../definitions/Request/Account";
import * as mainModel from "../main.model";
import { logBotIconChange, logChannelChange } from "../../../services/auditTrailsLogger";
import { tenantContents } from "../../../modules/globals";
const msRest = require('ms-rest');
const config = require('config');
const rp = require('request-promise');

const logger = Logger.getInstance();
const WebResource = msRest.WebResource;
let credentials: msrestAzure.ApplicationTokenCredentials;

export const ARM_URL = 'https://management.azure.com/subscriptions';
const VER = '2020-06-02';

export async function readChannels(account: any) {
    const client = await getClient();

    const definedChannelsMap = await geChannels(client, account.armGroup, account.botName);
    const tenantConfig = await tenantContents[account.name].config.load();
    return {...definedChannelsMap, ...tenantConfig.get("adapters")};
}

export async function readBotProperties(account: any) {
    const client = await getClient();
    const requestUrl = `${ARM_URL}/${client.subscriptionId}/resourceGroups/${account.armGroup}/providers/Microsoft.BotService/botservices/${account.botName}?api-version=${VER}`;
    let options = {
        uri: requestUrl,
        method: 'get',
        json: true,        
    };
    options = await signArmRequest(client, options);
    return rp(options);
}

export async function getChannel(account: any, channelName: string): Promise<any> {
    const tenantConfig = await tenantContents[account.name].config.load();

    if (tenantConfig.has(`adapters.${channelName}`)) {
        return tenantConfig.get(`adapters.${channelName}.properties`);
    }

    const client = await getClient();
    const channeProps: any = await getChannelWithKeys(client, account.armGroup, account.botName, channelName);
    
    channeProps.app_secret = account.app_secret;
    channeProps.app_id = account.app_id;
    channeProps.callbackUrl = "https://facebook.botframework.com/api/v1/bots/" + account.botName;

    return channeProps;
}

/**
 * Delete the channel
 *
 * @param account 
 * @param channelName 
 */
export async function deleteChannel(account: any, user: any, channelName: string) {
    const tenantConfig = await tenantContents[account.name].config.getOverrides(); 
    let result;
    if (tenantConfig.adapters && tenantConfig.adapters[channelName]) {
        delete tenantConfig.adapters[channelName];
        await tenantContents[account.name].config.save(tenantConfig);
        mainModel.reloadTenant(account.name);
    } else {        
        const client = await getClient();
        const requestUrl = `${ARM_URL}/${client.subscriptionId}/resourceGroups/${account.armGroup}/providers/Microsoft.BotService/botservices/${account.botName}/channels/${channelName}?api-version=${VER}`;
        let options = {
            uri: requestUrl,
            method: 'delete',
            json: true,        
        };
        options = await signArmRequest(client, options);
        result = await rp(options);
        logChannelChange(account.name, "deleted", user.emails[0].value, channelName);
    }
    logger.debug({logContext: {tenantName: account.name}}, `[Channels] Channel ${channelName} was deleted`);
    return result;
}

/**
 * Create a channel
 *
 * @param account 
 * @param channelName 
 * @param body 
 */
export async function createChannel(account: any, user: any, channelName: string, body: any) {
    let result;

    if (body.location === 'adapter') {
        const tenantConfig = await tenantContents[account.name].config.getOverrides();
        if (!tenantConfig.adapters) {
            tenantConfig.adapters = {};
        }
        body.properties.properties.serviceEndpointUri = `${config.get('bot.url')}/dynabot/${account.name}/whatsapp`;
        tenantConfig.adapters[body.properties.channelName]  = body.properties;

        await tenantContents[account.name].config.save(tenantConfig);
        mainModel.reloadTenant(account.name);
    }
    else {
        const client = await getClient();
        const requestUrl = `${ARM_URL}/${client.subscriptionId}/resourceGroups/${account.armGroup}/providers/Microsoft.BotService/botservices/${account.botName}/channels/${channelName}?api-version=${VER}`;
        let options = {
            uri: requestUrl,
            method: 'put',
            json: true,      
            body  
        };
        options = await signArmRequest(client, options);
        result = await rp(options);
        logChannelChange(account.name, "created", user.emails[0].value, channelName);

    }
    logger.debug({logContext: {tenantName: account.name}}, `[Channels] Channel ${channelName} was created`);
    return result;
}

/**
 * 
 * @param account 
 * @param channelName 
 * @param body 
 */
export async function modifyChannel(account: any, user: any, channelName: string, body: any) {
    let result;
    if (body.location === 'adapter') {
        const tenantConfig = await tenantContents[account.name].config.getOverrides();
        tenantConfig.adapters[body.properties.channelName]  = body.properties;
        await tenantContents[account.name].config.save(tenantConfig);
        mainModel.reloadTenant(account.name);
    }
    else {
        const client = await getClient();
        const requestUrl = `${ARM_URL}/${client.subscriptionId}/resourceGroups/${account.armGroup}/providers/Microsoft.BotService/botservices/${account.botName}/channels/${channelName}?api-version=${VER}`;
        let options = {
            uri: requestUrl,
            method: 'patch',
            json: true,      
            body
        };
        options = await signArmRequest(client, options);
        result = await rp(options);
        logChannelChange(account.name, "modified", user.emails[0].value, channelName);
    }
    logger.debug({logContext: {tenantName: account.name}},  `[Channels] channel ${channelName} was modified`);
    return result;
}

export async function updateBotIcon(account: IAccount, editor: string, iconUrl: string, iconFileName: string) {
    const client = await getClient();
    const requestUrl = `${ARM_URL}/${client.subscriptionId}/resourceGroups/${account.armGroup}/providers/Microsoft.BotService/botservices/${account.botName}?api-version=${VER}`;
    const body = {
        properties: {
            iconUrl
        }
    };
    let options = {
        uri: requestUrl,
        method: 'patch',
        json: true,      
        body
    };
    options = await signArmRequest(client, options);
    const result = await rp(options);
    logBotIconChange(account.name, "modified", editor, iconFileName);
    return result;
}

/**
 * Private functions
 */
async function getClient(): Promise<ResourceManagementClient> {
    if (credentials) { 
        credentials.getToken( async (err, token) => {
            if (err) {
                // token expired - get new one
                credentials = await getNewCredentials();
            }
            // No need to get the token, it's still valid
        });
    }
    else {
        credentials = await getNewCredentials();
    }
    return new ResourceManagementClient(credentials, config.get('arm_accountPrinciple.subscriptionId'));
}

async function getNewCredentials(): Promise<msrestAzure.ApplicationTokenCredentials> {
    const authResult = await msrestAzure.loginWithServicePrincipalSecretWithAuthResponse(
        config.get('arm_accountPrinciple.clientId'),
        (await mainModel.kvService.getSecret('arm-principle-password')),
        config.get('arm_accountPrinciple.tenantId'), {});
    return authResult.credentials;
}

async function geChannels(client: ResourceManagementClient, groupName: string, tenantId: string): Promise<any> {
    const requestUrl = `${ARM_URL}/${client.subscriptionId}/resourceGroups/${groupName}/providers/Microsoft.BotService/botservices/${tenantId}/channels?api-version=${VER}`;
    let options = {
        uri: requestUrl,
        method: 'get',
        json: true,        
    };

    try {
        options = await signArmRequest(client, options);
        const response = await rp(options);
        const channelsProp = response.value.map((v) => v.properties);
        const channels = {};
        for (let i = 0; i < channelsProp.length; i++) {
            channels[channelsProp[i].channelName] = channelsProp[i];
        }
        return channels;
    }
    catch (err) {
        return undefined;
    }
}

async function getChannelWithKeys(client: ResourceManagementClient, groupName: string, tenantId: string, channelName: string): Promise<any> {
    const requestUrl = `${ARM_URL}/${client.subscriptionId}/resourceGroups/${groupName}/providers/Microsoft.BotService/botservices/${tenantId}/channels/${channelName}/listChannelWithKeys?api-version=${VER}`;
    let options = {
        uri: requestUrl,
        method: 'post',
        json: true,        
        body: {            
        }
    };
    try {
        options = await signArmRequest(client, options);
        const keys = await rp(options);
        return keys.properties.properties || {};
    }
    catch (err) {
        return undefined;
    }
}

/**
 * Sign header with the ARM token
 *
 * @param client 
 * @param options 
 */
async function signArmRequest(client: ResourceManagementClient, options: any): Promise<any> {
    const wr = new WebResource();
    wr.headers = {};
    return new Promise((resolve1, reject) => {
        client.credentials.signRequest(wr, (err) => {
            if (!err) {
                options.headers = wr.headers;
                resolve1(options);
            }
            else {
                reject(err);
            }
        });
    }); 
}
