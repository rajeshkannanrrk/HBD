/**
 * Provide UI for creating and editing scenarios
 */

import {Server} from "http";

require('dotenv').config();
const appStartTime = new Date();

import {Logger} from 'healthbotcommon/logger';
import {eventProperties} from './logging';

const config = require('config');
const logger = Logger.getInstance();

import {K8S} from "healthbotcommon/k8s";
const k8s = K8S.getInstance();

if (!process.env.ApplicationInsightsInstrumentationKey) {
    logger.info(null, 'ApplicationInsightsInstrumentationKey env var is missing, exiting app');
    process.exit(1);
}

logger.startAppInsights('hbs-portal', process.env.ApplicationInsightsInstrumentationKey, undefined);
logger.initMdsdFluentLogger(config.get('geneva_services.host'), config.get('geneva_services.mdsd_fluent_port'));

Logger.setLogLevel('debug');
Logger.setEventProperties(eventProperties);
logger.event(null, "AppInitStart");
logger.info(null, "App Init Start");


import * as rabbitManager from "healthbotcommon/RabbitMQ/RabbitMQManager";
import * as csrf from 'csurf';
import * as express from 'express';
import { Server as IOServer, Socket } from 'socket.io';
import { createAdapter } from 'socket.io-redis';
import {AzureStorageAsync} from 'healthbotcommon/azurestorageasync';
import {AzureBlobServiceAsync} from "healthbotcommon/azurestorageasync/azureblobserviceasync";
import {AzureTableServiceAsync} from "healthbotcommon/azurestorageasync/azuretableserviceasync";
import {KeyVault} from 'healthbotcommon/keyvault';
import {
    tenantContentClientFactory,
    Config as TenantContentClientConfig, UpdateScenarioParameters, LightScenario
} from "healthbotcommon/tenantcontent";
import { StorageHost } from 'azure-storage';
import * as redisClientManager from 'healthbotcommon/redisClientManager';
import * as auth from "./modules/auth";
import * as subHandlers from "./modules/subscriptionHandlers";

// general app mw + Auth
import * as messageBrokerEventHandler from './modules/messageBrokerEventsHandlerManager';
import * as redisManager from './modules/redisManager';

// management portal controllers and models
import {router as apiController} from "./controllers/admin-portal-api/api.ctrl";
import {router as mainController} from "./controllers/admin-portal-v3/main.ctrl";
import * as mainModel from "./models/admin-portal-v3/main.model";

// system api controller
import {router as apiSystemController} from "./controllers/admin-portal-api/api.system.ctrl";

const path = require('path');
const swaggerUi = require('swagger-ui-express');

const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yml');

const azure = require('azure-storage');

const bodyParser = require('body-parser');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const pjson = require('./package.json');
import * as globals from './modules/globals';
import {HealthBotUtils} from "healthbotcommon/healthbotutils";
import {AddressInfo} from "net";

export const app = express();
const kv = KeyVault.getInstance();

// app start
app.use(helmet());
app.use(helmet.noSniff());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false, limit: '5mb'}));
// parse application/json
app.use(bodyParser.json({limit: '5mb'}));

let tenantStorageTableSvc: AzureTableServiceAsync;
let tenantCosmosTableSvc: AzureTableServiceAsync;
let botTableSvc: AzureTableServiceAsync;
let blobSvc: AzureBlobServiceAsync;
let adminBlobSvc: AzureBlobServiceAsync;
let globalBlobSvc: AzureBlobServiceAsync;
let globalCosmosTableSvc: AzureTableServiceAsync;

let io: IOServer;
let subscriptionEventHandler;

interface ISocketEvent {
    userRole: string;
    sysAdminReadOnly: string;
    id: string;
    tenantId: string;
    tenantName: string;
    userName: string;
}

let server: Server;

/** ******************************************************************************************************
 * General functions
 ********************************************************************************************************/
async function initApp() {
    const application = app;
    k8s.setDnsToTest("hbs-messagebroker-rabbitmq-ha").useStartup(application).useReadiness(application).useLiveness(application);
    server = await HealthBotUtils.startServer(application);
    logger.info(null, `Express server listening on port ${(server.address() as AddressInfo).port}`);
    const success: boolean = await kv.init(config.get('key_vault'));
    if (!success) {
        logger.info(null, 'Exiting app after key vault initialization failure');
        await logger.flushTelemetryLoggersAsync();
        process.exit(1);
    }

    try {
        await redisManager.init();
    } catch (error) {
        logger.info(null, `Exiting app after Redis initialization failure, error= ${error}`);
        await logger.flushTelemetryLoggersAsync();
        process.exit(1);
    }

    application.get('/health', async (req: express.Request, res: express.Response) => {
        // Checking availability of the following dependencies - Redis, Storage
        try {
            await redisManager.handyRedisClient.get('dummy_key');
            await mainModel.blobService.getBlobToText('config', 'tenant.json');
            res.send('System Healthy');
        } catch (error) {
            logger.error(null, `/health endpoint failed due to the following error: ${error}`);
            res.status(500).send('System not Healthy');
        }
    });
    app.use('/api/system', apiSystemController);
    app.use('/api', apiController);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    app.get('/api-swagger.json', (req, res) => {
        res.status(200).send(swaggerDocument);
    });
    application.set('trust proxy', 1);
    application.use(express.static(path.join(__dirname, 'public')));
    application.use(cookieParser());
    const redisConfig: any = config.get('redis');
    const mergedConfig: any = { ...redisConfig.common, ...redisConfig.portal };
    application.use(await redisClientManager.getRedisSessionMiddleware(redisManager.redisClient, mergedConfig));
    application.use(csrf());
    application.use((req, res, next) => {
        res.cookie('XSRF-TOKEN', req.csrfToken());
        return next();
    });
    auth.use(application);

    // this handler will update cookie field "lastValidAccess" to allow session status check without touching the session.
    application.post('/activity', (req, res) => res.status(200).send());

    application.set('views', path.join(__dirname, 'views'));
    application.set('view engine', 'ejs');
    application.use('/account/:account/', mainController);
    application.use((error, req, res, next) => {
        logger.error(null, `an error an error occurred, url - ${req.url}, error = ${error}`);
        res.render('admin-portal-v3/error', { error: 'Sorry, something went wrong.\n Please try to refresh this page' });
    });

    // CosmosDB
    const tenantCosmosHostUrl = `https://${config.get('azure_storage.cosmos_table_account_name')}.table.cosmosdb.azure.com:443/`;
    const cosmosSecret = await kv.getSecret(config.get('azure_storage.cosmos_table_secret_name'));
    tenantCosmosTableSvc = AzureStorageAsync.createTableService(config.get('azure_storage.cosmos_table_account_name'), cosmosSecret, tenantCosmosHostUrl);
    
    // Tenant storage
    const tenantStorageAccountName: string = config.get('azure_storage.account_name'); 
    const tenantStorageTableHost = `${tenantStorageAccountName}.table.core.windows.net`;
    const tenantStorageSasToken: string = await kv.getSecret(config.get('azure_storage.sas_token_name'));
    tenantStorageTableSvc = AzureStorageAsync.createTableServiceWithSas(tenantStorageTableHost, tenantStorageSasToken);
    const tenantStorageBlobHost = `${tenantStorageAccountName}.blob.core.windows.net`;
    blobSvc = AzureStorageAsync.createBlobServiceWithSas(tenantStorageBlobHost, tenantStorageSasToken);
    
    // GlobalStorageService
    // **global blob svc
    const globalStorageBlobPrimaryHost = `${config.get('global_azure_storage.account_name')}.blob.core.windows.net`;
    const globalStorageBlobSecondaryHost = `${config.get('global_azure_storage.account_name')}-secondary.blob.core.windows.net`;
    const globalStorageBlobHost: StorageHost = {
        primaryHost: globalStorageBlobPrimaryHost,
        secondaryHost: globalStorageBlobSecondaryHost
    };
    const globalStorageSasToken: string = await kv.getSecret(config.get('global_azure_storage.sas_token_name'));
    globalBlobSvc = AzureStorageAsync.createBlobServiceWithSas(globalStorageBlobHost, globalStorageSasToken);

    // **global cosmos table svc
    const globalCosmosTableAccountName = config.get('global_azure_storage.cosmos_table_account_name');
    const globalCosmosHostUrl = `https://${globalCosmosTableAccountName}.table.cosmosdb.azure.com:443/`;
    const globalCosmosSecret = await kv.getSecret(config.get('global_azure_storage.cosmos_table_secret_name'));
    globalCosmosTableSvc = AzureStorageAsync.createTableService(globalCosmosTableAccountName, globalCosmosSecret, globalCosmosHostUrl);

    // Inner bot storage
    const innerBotAccountName: string = config.get('inner_bot_storage.account_name');
    const innerBotStorageTableHost = `${innerBotAccountName}.table.core.windows.net`;
    const innerBotStorageSasToken: string = await kv.getSecret(config.get('inner_bot_storage.sas_token_name'));
    botTableSvc = AzureStorageAsync.createTableServiceWithSas(innerBotStorageTableHost, innerBotStorageSasToken);
    
    // Feedback blob container
    const innerBotStorageBlobHost = `${innerBotAccountName}.blob.core.windows.net`;
    const feedbackContainerSasToken: string = await kv.getSecret(config.get('inner_bot_storage.feedback_container_sas_token_name'));
    const feedbackBlobSvc: AzureStorageAsync = AzureStorageAsync.createBlobServiceWithSas(innerBotStorageBlobHost, feedbackContainerSasToken);
    const feedbackContainerName: string = config.get('inner_bot_storage.feedback_container_name');
    
    // Admin storage 
    const adminStorageBlobHost = `${config.get('admin_storage.account_name')}.blob.core.windows.net`;
    const adminStorageSasToken: string = await kv.getSecret(config.get('admin_storage.sas_token_name'));
    adminBlobSvc = AzureStorageAsync.createBlobServiceWithSas(adminStorageBlobHost, adminStorageSasToken);
    
    await auth.init(application, {windowslive: (await kv.getSecret(config.get('auth.windowslive.secret_name')))}, tenantCosmosTableSvc);
    await rabbitManager.init(config.get('rabbit_mq.server_endpoint'), (await kv.getSecret(config.get('rabbit_mq.secret_name'))));
    
    subscriptionEventHandler = new messageBrokerEventHandler.MessageBrokerEventsHandlerManager(rabbitManager, config.get('rabbit_mq.topics.events_for_portal'));
    await initSubscriptionEventHandler();

    await initTenants(tenantStorageSasToken, await kv.getSecret(config.get("tenant_storage_v2.sas_token_name")), innerBotStorageSasToken, cosmosSecret);

    await mainModel.init(pjson, blobSvc, tenantStorageTableSvc, tenantCosmosTableSvc, botTableSvc, adminBlobSvc, globalBlobSvc, globalCosmosTableSvc, kv, sendReloadTenantToBot, sendErrorToClient,
        sendReloadScenarioToBot, sendReloadDataConnectionsToBot, feedbackBlobSvc,
        feedbackContainerName, sendReloadLocalizationToBot, sendUpdateLocalizationSettingsToBot,
        sendRemoveTenantToBot, sendEventToPortal);

    try {
        await subscriptionEventHandler.listen();
    }
    catch (err) {
        logger.error(null, err);
    }

    io = new IOServer(server, {
        pingInterval: 10000,
        pingTimeout: 2000,
    });

    io.adapter(createAdapter(
        {
            pubClient: (await redisManager.createPrivateClient(true)),
            subClient: (await redisManager.createPrivateClient(true))
        }
    ));
    mainModel.registerSocketIO(io);

    io.on('connection', (socket: Socket) => {
        if (socket.handshake.query.tenantId) {
            socket.join(socket.handshake.query.tenantId);
        }
        socket.on('editingScenario', async (event: ISocketEvent) => {
            // Set the scenario id as editing
            if (event.userRole === "Reader" || event.userRole === "CSS") {
                return;
            }
            if (event.userRole === "System Admin" && event.sysAdminReadOnly === 'true') {
                return;
            }
            const scenario: LightScenario = await globals.tenantContents[event.tenantName].scenarios.getLightScenario(event.id);
            if (scenario.currentUser !== event.userName) {
                try {
                    await updateScenarioCurrentEditor(event.id, event.tenantName, undefined, event.userName);
                    io.to(event.tenantId).emit('notifyEditing', event);
                    logger.debug(null, "client started editing");
                } catch (error) {
                    logger.error(null, "Failed to update editing " + error);
                }
            }
        });

        const exitEditor = async (event: ISocketEvent) => {
            try {
                const scenario: LightScenario = await globals.tenantContents[event.tenantName].scenarios.getLightScenario(event.id);
                if (scenario.currentUser === event.userName) {
                    await updateScenarioCurrentEditor(event.id, event.tenantName, undefined, '');
                    logger.debug(null, 'client has disconnected');
                    io.to(event.tenantId).emit('notifyDoneEditing', event);
                }
            } catch (disconnectError) {
                logger.error(null, 'failed to remove client from editing ' + disconnectError);
            }
        };

        // When diconnect is detected
        socket.on('disconnect', (reason) => {
            if (socket.handshake.query?.id) {
                const event: ISocketEvent = {
                    id: socket.handshake.query.id as string,
                    tenantId: socket.handshake.query.tenantId as string,
                    tenantName: socket.handshake.query.tenantName as string,
                    userName: socket.handshake.query.userName as string,
                    userRole: socket.handshake.query.userRole as string,
                    sysAdminReadOnly: socket.handshake.query.sysAdminReadOnly as string
                };
                exitEditor(event);
            }
        });

        // User clicks on save and exit or cancel buttons
        socket.on('exitScenario', (event: ISocketEvent) => {
            exitEditor(event);
        });

        registerResourcesSpecialEndpoints(application);
    });

    const appInitCompleteTime = new Date();
    const duration = (appInitCompleteTime.getTime() - appStartTime.getTime()) / 1000;
    logger.eventWithCustomFields("AppInitComplete", {duration});
    logger.info(null, "App Init Complete, took " + duration + " seconds");

    if (!config.get("is_local_dev")) {
        Logger.removeConsoleTransport();
    }

    k8s.setStarted();
    if (config.get("is_local_dev")) {
        logger.info(null, `Tenant admin portal (v3) : "http://localhost:${(server.address() as AddressInfo).port}/account/healthagentlocaldev/"`);
    }
}

/**
 * This function will handle the init of the tenants list
 */
async function initTenants(tenantSasToken: string, tenantV2SasToken: string, botSasToken: string, cosmosSecret: string) {
    const query = new azure.TableQuery();

    const tenants = [];
    let continuationToken = null;

    do {
        const response = await tenantCosmosTableSvc.queryEntitiesWithContinuationToken("tenants", query, continuationToken);
        tenants.push(...response.value);
        continuationToken = response.continuationToken;
    } while (continuationToken);

    const clientConfig: TenantContentClientConfig = {
        tenantAsa: { name: config.get("azure_storage.account_name"), sasToken: tenantSasToken },
        tenantAsaV2: { name: config.get("tenant_storage_v2.account_name"), sasToken: tenantV2SasToken },
        botAsa: { name: config.get("inner_bot_storage.account_name"), sasToken: botSasToken },
        cosmosAccount: { accountName: config.get('azure_storage.cosmos_table_account_name'), accountKey: cosmosSecret }
        
    };

    for (const tenant of tenants) {
        tenant.id = tenant.RowKey;
        globals.tenants[tenant.name] = tenant;
        globals.tenantContents[tenant.name] = tenantContentClientFactory(tenant, clientConfig);

        try {
            await globals.tenantContents[tenant.name].init();
        } catch (err) {
            logger.error(null, `Failed initializing tenant contents facade for tenant ${tenant.name}: ${err}`);
        }
    }
}

async function initSubscriptionEventHandler() {
    await subscriptionEventHandler.init();
    subscriptionEventHandler.addEventHandler(subHandlers.EventsNames.deleteTenant, subHandlers.deleteTenantHandler);
    subscriptionEventHandler.addEventHandler(subHandlers.EventsNames.saveTenant, subHandlers.saveTenantHandler);
    subscriptionEventHandler.addEventHandler(subHandlers.EventsNames.updateTenant, subHandlers.updateTenantHandler);
    subscriptionEventHandler.addEventHandler(subHandlers.EventsNames.loadTenantUsers, subHandlers.loadTenantUsersHandler);
}

/**
 * This function will get a tenant name and use the rabbitMQ to send a "reload" notification
 *
 * @param tenantName
 * @param tenantData? - Should be passed in case globals.tenants[tenantName] may not be up-to-date.
 */
const sendReloadTenantToBot =  (tenantName, tenantData?: any) => {
    const body = JSON.stringify(tenantData ? tenantData : globals.tenants[tenantName]);
    sendEventToBot(body, "reloadTenant");
};

const sendRemoveTenantToBot =  (tenantName) => {
    const body = JSON.stringify({tenantName});
    sendEventToBot(body, "removeTenant");
};

const sendReloadScenarioToBot = (tenantName, oldName, newName,  active, scenario) => {
    const body = {
        tenant : globals.tenants[tenantName],
        oldName,
        newName,
        active,
        scenario
    };
    sendEventToBot(JSON.stringify(body), "reloadScenario");
};

const sendReloadLocalizationToBot = (tenantName, localizationType) => {
    const body = {
        tenant : globals.tenants[tenantName],
        updateType: "localizedStrings",
        localizationType
    };
    sendEventToBot(JSON.stringify(body), "updateLocalization");
};

const sendUpdateLocalizationSettingsToBot = (tenantName, settings) => {
    const body = {
        tenant : globals.tenants[tenantName],
        updateType: "localizationSettings",
        settings
    };
    sendEventToBot(JSON.stringify(body), "updateLocalization");

    const tenantId = globals.tenants[tenantName].RowKey;
    io.to(tenantId).emit('localizationSettingsChanged', {tenantId});
};

const sendReloadDataConnectionsToBot = (tenantName) => {
    const body = JSON.stringify(globals.tenants[tenantName]);
    sendEventToBot(body, "reloadDataConnections");
};

const sendEventToBot =  async (body: string, name: string) => {
    const message = {
        body,
        customProperties: {name}
    };
    let messageAsString: string;
    try {
        messageAsString = JSON.stringify(message);
    }
    catch (err) {
        logger.error(null, `Error occurred when stringifying json. \n\n Error: ${err.message}. \n\n JSON: ${message}`);
    }
    await rabbitManager.sendTopicMessage(config.get('rabbit_mq.topics.events_for_bot'), messageAsString);
};

const sendEventToPortal = async (bodyObj: Record<string, any>, name: string) => {
    const body = JSON.stringify(bodyObj);
    const message = {
        body,
        customProperties: {name}
    };
    let messageAsString: string;
    try {
        messageAsString = JSON.stringify(message);
    }
    catch (err) {
        logger.error(null, `Error occurred when stringifying json. \n\n Error: ${err.message}. \n\n JSON: ${message}`);
    }
    await rabbitManager.sendTopicMessage(config.get('rabbit_mq.topics.events_for_portal'), messageAsString);
};

const sendErrorToClient = (res, error) => {
    const statusCode = error.statusCode ? error.statusCode : 400;
    const message = error.message ? error.message : "an error occurred";
    logger.error(null, "sendErrorToClient with status code " + statusCode + " and message " + message);
    res.status(statusCode).send(message);
};

const updateScenarioCurrentEditor = async (id: string, tenantName: string, updated: Date, userName: string) => {
    const updateScenario: UpdateScenarioParameters = {
        RowKey: id,
        currentUser : userName,
        updated :  updated ? updated : undefined
    };
    await globals.tenantContents[tenantName].scenarios.updateScenario(updateScenario);
};

function registerResourcesSpecialEndpoints(application: express.Express) {
    application.get('/resources/synonyms', (req, res) => {
        // var synonyms = utils.getSynonyms();
        const synonyms = [];
        res.status(200).send(synonyms);
    });

    application.get('/resources/bodylocations', (req, res) => {
        const locations = [];
        res.status(200).send(locations);
    });
}

process.on('uncaughtException',  (err) => {
    logger.exception(null, err);
});

process.on('unhandledRejection', (reason, p) => {
    logger.exception(null, new Error('unhandledRejection occurred: ' + reason));
});

process.on('SIGTERM', async () => {
    logger.event(null, "SIGTERM");
    logger.info(null, 'Received SIGTERM, flushing events');
    await logger.flushTelemetryLoggersAsync();
    logger.info(null, "Exiting app after SIGTERM");
    process.exit(0);
});

export const appReady = initApp();
