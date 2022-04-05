import { Router } from "express";
import { errorHandlers, requireRole, requireSysAdminWriteMode } from "../../../middlewares/auth";
import * as secretsModel from "../../../models/admin-portal-v3/integration/integration.secrets.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole } from "../../../modules/auth";
import { tenantContents } from "../../../modules/globals";
import * as subscriptionHandlers from "../../../modules/subscriptionHandlers";

export const router = Router();

const requireAdminRole = requireRole(UserRole.Admin, errorHandlers.statusForbidden("Readers & Editors are not allowed for this operations"));
const denyAccessIfNotAdmin = requireRole(UserRole.Admin, errorHandlers.renderErrorPage("You can't access this page"));
const denyAccessIfNotEditor = requireRole(UserRole.Admin, errorHandlers.renderErrorPage("You can't access this page"));

router.use((req, _, next) => {
    req._navigation_path.push("secrets");
    next();
});

router.get('/', denyAccessIfNotEditor, async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/integration/integration.secrets.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/read/information', denyAccessIfNotEditor, async (req, res) => {
    const data =
        [
            { name: "tenantName", value: req.account.name },
            { name: "Application ID", value: req.account.app_id }
        ];
    res.status(200).send(data);
});

router.get('/read/secrets', denyAccessIfNotAdmin, async (req, res) => {
    const apiJwtKey: string = req.account.api_jwt_secret;
    const data =
        [
            { name: "APP_SECRET", value: req.account.app_secret },
            { name: "WEBCHAT_SECRET", value: req.account.webchat_secret },
            { name: "API_JWT_SECRET", value: apiJwtKey, action: "generateApiKey", actionName: apiJwtKey ? "Regenerate Key" : "Generate Key" }
        ];
    res.status(200).send(data);
});

router.get('/read/instrumentationKey', denyAccessIfNotAdmin, async (req, res) => {
    const tenantConfig = await tenantContents[req.account.name].config.load();
    const instrumentationKey = tenantConfig.get("instrumentationKey");

    return res.status(200).send(instrumentationKey);
});

router.post('/actions/generateApiKey', requireAdminRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const newApiKey = await secretsModel.generateApiKey(req.account.id, req.account.name);
        await mainModel.sendEventToPortal({ name: req.account.name, api_jwt_secret: newApiKey }, subscriptionHandlers.EventsNames.updateTenant);
        res.status(200).send(newApiKey);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/actions/updateInstrumentationKey', requireAdminRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const instrumentationKey: string = req.body.key;
        const instrumentationKeyPattern = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');
        if (instrumentationKey && !instrumentationKeyPattern.test(instrumentationKey)) {
            throw new Error('invalid instrumentation key');
        }

        const tenantConfig = await tenantContents[req.account.name].config.getOverrides();

        tenantConfig.instrumentationKey = instrumentationKey;

        await tenantContents[req.account.name].config.save(tenantConfig);
        mainModel.reloadTenant(req.account.name);

        res.status(200).send(instrumentationKey);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/read/customTelemetryPHIState', denyAccessIfNotAdmin, async (req, res) => {
    const tenantConfig = await tenantContents[req.account.name].config.load();
    const customTelemetryPHI = tenantConfig.get("customTelemetryPHI");

    res.status(200).send(customTelemetryPHI);
});

router.post('/actions/toggleCustomTelemetryPHIState', requireAdminRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const tenantConfig = await tenantContents[req.account.name].config.getOverrides();

        tenantConfig.customTelemetryPHI = !tenantConfig.customTelemetryPHI;

        await tenantContents[req.account.name].config.save(tenantConfig);
        mainModel.reloadTenant(req.account.name);

        res.status(200).send(tenantConfig.customTelemetryPHI);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
