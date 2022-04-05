import * as jwt from 'jsonwebtoken';
import * as moment from "moment";
import { Router } from 'express';
import * as fileUpload from 'express-fileupload';
import { Logger } from "healthbotcommon/logger";
import * as mainModel from "../../models/admin-portal-v3/main.model";
import * as scenariosManageModel from "../../models/admin-portal-v3/scenarios/scenarios.manage.model";
import * as scenariosValidationModel from "../../models/admin-portal-v3/scenarios/scenarios.validation.model";
import * as backupModel from "../../models/admin-portal-v3/backup-restore/backup.model";
import * as restoreModel from "../../models/admin-portal-v3/backup-restore/restore.model";
import { IRequestUser } from "../../definitions/Request/RequestUser";
import { tenantContents } from '../../modules/globals';
import { LightScenario } from "healthbotcommon/tenantcontent";
import { logLocalizationChange, logScenarioChange } from '../../services/auditTrailsLogger';

const logger = Logger.getInstance();

export const router = Router();

const editorUser = {
    emails: [{value: "API"}]
};

router.param('account', (req, res, next, accountName) => {
    logger.info(null, `Management API - access through host: ${req.hostname} by tenant: ${accountName} action: (${req.method}) ${req.path}`);
    const globals = require('../../modules/globals');
    if (globals.tenants[accountName]) {
        req.account = globals.tenants[accountName];
        if (req.account.customDomain && req.account.customDomain !== req.hostname) {
            res.redirect(301, `https://${req.account.customDomain}${req.originalUrl}`);
        } else {
            next();
        }
    } else {
        res.status(404).send('404: Account not Found');
    }
});

/* eslint no-throw-literal: 0 */
router.use("/account/:account", (req, res, next) => {
    try {
        if (!req.headers.hasOwnProperty("authorization")) {
            throw {code: 400, message: "Authorization header is missing from the request"};
        }
        const jwtToken = req.headers.authorization.match(/Bearer\s(.*\..*\..*)/);
        if (!jwtToken) {
            throw {code: 400, message: "Authorization header - wrong format"};
        }
        let decodedJWT: any;
        try {
            decodedJWT = jwt.verify(jwtToken[1], req.account.api_jwt_secret);
        } catch (e) {
            throw {code: 401, message: "Authorization error - JWT verification failed"};
        }
        if (!decodedJWT.tenantName || decodedJWT.tenantName !== req.account.name) {
            throw {code: 400, message: "tenant name mismatch"};
        }
        const now = moment();
        const validityMaxTime = now.clone().add(3, 'minutes').unix();
        const validityMinTime = now.clone().subtract(10, "minutes").unix();
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
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});
/* eslint no-throw-literal: 1 */

router.get('/account/:account/scenarios', async (req, res) => {
    try {
        const filter = req.query.scenarioName?.toString() ?? "all";
        const accountScenarios = await scenariosManageModel.getExportJson(filter, req.account);
        const scenariosArray = accountScenarios.map((senario) => senario.data);
        return res.status(200).send(scenariosArray);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/account/:account/scenarios', async (req, res) => {
    if (!req.is('json')) {
        res.status(400).send("Content type should be application/json");
        return;
    }
    try {
        if (!Array.isArray(req.body)) {
            req.body = [req.body];
        }
        // TODO: verify this stable req.body with the updating of the active flag.
        const scenariosToImport = await scenariosValidationModel.validateAPIimport(req.body, req.account); // 2 step validation. throw for errors, deactivate for problems and warnings
        await scenariosManageModel.importFromJson(scenariosToImport, req.account, editorUser);
        return res.sendStatus(200);
    } catch (error) {
        mainModel.sendErrToClient(res, (Array.isArray(error) ? {message: error.join("\n"), code: 400} : error));
    }
});

router.delete('/account/:account/scenarios/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const scenario: LightScenario = await tenantContents[req.account.name].scenarios.getLightScenario(id);
        await tenantContents[req.account.name].scenarios.deleteScenario(id);
        mainModel.reloadScenario(req.account.name, scenario.scenario_trigger, scenario.scenario_trigger, false, undefined);
        logScenarioChange(req.account.name, "deleted", editorUser.emails[0].value, scenario.name, scenario.scenario_trigger);
        return res.sendStatus(200);
    } catch (error) {
        mainModel.sendErrToClient(res, (Array.isArray(error) ? {message: error.join("\n"), code: 400} : error));
    }
});

router.get('/account/:account/backup', async (req, res) => {
    try {
        const data = await backupModel.createBackup(req.account, editorUser as IRequestUser, true, false);
        res.setHeader("Content-disposition", `attachment; filename= ${moment().utc().format('YYYY-MM-DD_HH-mm-ss')}_${req.account.name}.hbs`);
        res.setHeader('Content-type', 'text/plain');
        res.status(200).send(data);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/account/:account/backup', async (req, res) => {
    try {
        await restoreModel.restoreBackup(req.account, req.body.hbs, editorUser as IRequestUser, true);
        res.status(200).send("OK");
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/account/:account/resources', async (req, res) => {
    try {
        const files = await tenantContents[req.params.account].resources.getAll();

        res.status(200).send(files);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/account/:account/resources', fileUpload({ useTempFiles: true }), async (req, res) => {
    try {
        const promises = [];

        for (const file of Object.values(req.files)) {
            if (Array.isArray(file)) {
                return res.status(400).send("Can't upload multiple files");
            }
            if (file.size > 1024 * 1024 * 10) {
                return res.status(400).send("File is too large - max size 10MB");
            }
            if (!/^[\w]+\.[\w]{3,4}$/.test(file.name)) {
                return res.status(400).send("File name is not valid");
            }
            const pr = tenantContents[req.params.account].resources.upload(file.name, file.tempFilePath, { blobContentType: file.mimetype, blobContentEncoding: file.encoding });
            promises.push(pr);
        }

        await Promise.all(promises);

        res.status(200).send("OK");
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.delete('/account/:account/resources', async (req, res) => {
    try {
        if (!req.query.name) {
            return res.status(200).send();
        }

        const filesToDelete = Array.isArray(req.query.name) ? req.query.name as string[] : [req.query.name.toString()];

        await Promise.all(filesToDelete.map(async (filename) => {
            try {
                await tenantContents[req.params.account].resources.delete(filename);
            } catch (err) {
                if (err.statusCode !== 404 && err.code !== "BlobNotFound") {
                    throw err;
                }
            }
        }));

        return res.status(200).send();

    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/account/:account/localization', async (req, res) => {
    try {
        const [custom, system] = await Promise.all([
            tenantContents[req.params.account].localization.custom.get(),
            tenantContents[req.params.account].localization.system.get()
        ]);

        res.status(200).json({ custom, system });
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/account/:account/localization', async (req, res) => {
    const normalizeStringId = (obj) => Object.fromEntries(Object.entries(obj).map(([key, value]) => [key.toLowerCase() === "string id" ? "stringId" : key, value]));

    try {
        const { system, custom } = req.body;

        if (system && system.length > 0) {
            await tenantContents[req.account.name].localization.system.saveChanges(system.map(normalizeStringId));
            logLocalizationChange(req.account.name, "modified", "API", "system");
        }

        if (custom && custom.length > 0) {
            await tenantContents[req.account.name].localization.custom.saveChanges(custom.map(normalizeStringId));
            logLocalizationChange(req.account.name, "modified", "API", "custom");
        }

        mainModel.updateLocalizationSettings(req.account.name);
        mainModel.reloadTenant(req.account.name);

        res.status(200).send();
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.use((req, res) => {
    res.status(404).send('404: Page not Found');
});
