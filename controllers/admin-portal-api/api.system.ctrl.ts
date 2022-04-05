import {KeyVault} from "healthbotcommon/keyvault";
import * as tenantsModel from "../../models/admin-portal-api/tenants.model";
import * as feedbacksModel from "../../models/admin-portal-v3/portal-feedbacks.model";
import * as restoreModel from "../../models/admin-portal-v3/backup-restore/restore.model";
import * as mainModel from "../../models/admin-portal-v3/main.model";
import * as scenarioModel from "../../models/admin-portal-v3/scenarios/scenarios.manage.model";
import * as reportsModel from '../../models/admin-portal-api/reports.model';
import * as rabbitManager from "healthbotcommon/RabbitMQ/RabbitMQManager";
import {Logger} from "healthbotcommon/logger";
const config = require('config');
const jwt = require('jsonwebtoken');
const express = require('express');
const moment = require('moment');
export const router = express.Router();
const kv = KeyVault.getInstance();
const globals = require('../../modules/globals');

const logger = Logger.getInstance();

/* eslint no-throw-literal: 0 */
router.use("/", async (req, res, next) => {

    try {
        // Check for authorization
        if (!req.headers.hasOwnProperty("authorization")) {
            throw {code: 400, message: "Authorization header is missing from the request"};
        }
        const jwtToken = req.headers.authorization.match(/Bearer\s(.*\..*\..*)/);
        if (!jwtToken) {
            throw {code: 400, message: "Authorization header - wrong format"};
        }
        let decodedJWT: any;
        try {
            const apiJwtSecret = await kv.getSecret('system-api-key');
            decodedJWT = jwt.verify(jwtToken[1], apiJwtSecret);
        }
        catch (error) {
            throw {code: 401, message: "Authorization error - JWT verification failed"};
        }
        const now = moment();
        const validityMaxTime = now.clone().add(3, 'minutes').unix();
        const validityMinTime = now.clone().subtract(3, "minutes").unix();
        try {
            decodedJWT.iat = Number(decodedJWT.iat);
        } catch (err) {
            throw {code: 401, message: "Authorization error - invalid iat value"};
        }
        if (!Number.isInteger(decodedJWT.iat) || decodedJWT.iat < validityMinTime || decodedJWT.iat > validityMaxTime) {
            logger.warning(null, `Authorization error - JWT token iat (creation time) is out of range. 
            iat=${decodedJWT.iat}, validityMinTime=${validityMinTime}, validityMaxTime=${validityMaxTime}`);
            throw {code: 401, message: "Authorization error - JWT token expired"};
        }
        next();    
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});
/* eslint no-throw-literal: 1 */

/* ---------------------------------------------------- Feedbacks ------------------------------------------------- */

router.get('/feedbacks/all', async (req, res) => {
    try {
        const feedbacks = await feedbacksModel.getAll(req.query.search);
        res.status(200).send(feedbacks);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

/* ---------------------------------------------------- Tenants CRUD ------------------------------------------------- */

router.get('/tenants', async (req, res) => {    
    const email = req.query.email;
    if (!email) {
        return mainModel.sendErrToClient(res, new Error("query string 'email' must be specified"));
    }
    try {
        const tenants = await tenantsModel.getByOwner(email);
        res.status(200).send(tenants);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/tenants/all', async (req, res) => {
    try {
        const tenants = await tenantsModel.getAll(req.query.search);
        res.status(200).send(tenants);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/tenants/configurations', async (req, res) => {
    try {
        const tenantConfigurations = await tenantsModel.getTenantConfigurations();
        res.status(200).send(tenantConfigurations);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.patch('/tenants/incrementAzureHealthBotTenantsCounter', async (req, res) => {
    try {
        await tenantsModel.incrementAzureHealthBotTenantsCounter();
        res.status(200).send();
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/tenants/countAzureHealthBots', async (req, res) => {
    try {
        const AzureHealthBotCount: number = await tenantsModel.countAzureHealthBotTenants();
        res.status(200).send({count: AzureHealthBotCount});
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.patch('/tenants/configurations/infermedica-system-strings-migration', async (_, res) => {
    // Migration completed, removed code due to updates in localization model.
    res.status(200).send();
});

router.get('/tenants/saas/:id', async (req, res) => {
    try {
        const tenant = await tenantsModel.getOneBySaasSubscriptionId(req.params.id);
        res.status(200).send(tenant);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);        
    }
});

router.post('/tenants', async (req, res) => {
    try {
        const id = await tenantsModel.save(req.body);
        res.status(200).send({id});
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/restore', async (req, res) => {
    try {        
        await restoreModel.restoreBackup(req.body.account, JSON.stringify(req.body.data), req.body.user, false);
        res.status(200).send("OK");
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/tenants/checkNameAvailability/:name', async (req, res) => {
    try {
        const tenant = await tenantsModel.getTenantByName(req.params.name);
        return res.status(200).send({
            nameAvailable: tenant === undefined ?  true :  false
        });
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/tenants/findByName/:name', async (req, res) => {
    try {
        const tenant = await tenantsModel.getTenantByName(req.params.name);
        return res.status(200).send(tenant);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }

});

router.delete('/tenants/:name', async (req, res) => {
    try {
        const response: any = await tenantsModel.startTenantDeletionSequence(req.params.name);
        if (response.status === 200) {
            return res.status(response.status).send(response.message);
        }
        return res.sendStatus(response.status);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/deleteTenantSilently/:name', async (req, res) => {
    try {
        await rabbitManager.sendQueueMessage(config.get('rabbit_mq.queues.msgs_queue_for_bot'), JSON.stringify({name: "DELETE_TENANT_SILENTLY", body: {tenantName: req.params.name, armGroup: req.body.botRegistrationResourceGroup}}), true);
        return res.status(200).send();
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.patch('/tenants/:name', async (req, res) => {
    try {
        const tenant = await tenantsModel.updateTenant(req.params.name, req.body);
        return res.status(200).send(tenant);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/scenarios', async (req, res) => {
    try {
        const results = await tenantsModel.getScenariosBySearchTerm(req.query.search);
        return res.status(200).send(results);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.patch('/tenants/:name/scenarios/code/:id', async (req, res) => {
    try {
        const tenant = globals.tenants[req.params.name];
        const baseUrl = `${req.protocol}://${req.header("host")}`;
        await scenarioModel.updateScenarioCode(tenant, req.params.id, req.body.code, false, req.body.user, baseUrl);
        return res.status(200).send();
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

// get this portals instance AppId to allow the report 
// to get a dynmic display of all locations
router.get('/reports/reportAppId', async (req, res) => {
    try {
        const result = {
            appId: config.get("application_insights.bot_application_id"),
            region: config.get("azure_healthbot.resource_region"),
        };
        res.status(200).send(result);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

// send a free text query to the application appinsight
router.get('/reports/queryAppInsight', async (req, res) => {
    try {
        const query: string = req.query;
        const result: Record<string, any> = await reportsModel.queryAppInsight(query);
        res.status(200).send(result);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/reports/blobData/:container/:blobId*', async (req, res) => {
    try {
        const container: string = req.params.container;
        const blobId: string = req.params.blobId + req.params[0]
        const result: any = await reportsModel.getGlobalBlobData(container, blobId);
        
        res.status(200).send(result);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/reports/:table', async (req, res) => {
    try {
        const table: string = req.params.table;
        const result: Record<string, any> = await reportsModel.getData(table);
        
        res.status(200).send(result);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});
