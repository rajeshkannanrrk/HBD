import { Router } from "express";
import { isResourceNotFoundError } from "healthbotcommon/tenantcontent";
import * as fhirModel from "../../../models/admin-portal-v3/integration/integration.fhir.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole } from "../../../modules/auth";
import { errorHandlers, requireRole, requireSysAdminWriteMode } from "../../../middlewares/auth";
import { tenantContents } from "../../../modules/globals";

export const router = Router();

const requireEditorRole = requireRole(UserRole.Editor, errorHandlers.statusForbidden("Readers not allowed for this operations"));

router.use((req, _, next) => {
    req._navigation_path.push("data-connections");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/integration/integration.data-connection.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/read', async (req, res) => {
    try {
        const tenantDataConnections = await tenantContents[req.account.name].dataConnections.getAll();
        res.status(200).send(tenantDataConnections.map((dc) => ({ ...dc, static_parameters: JSON.stringify(dc.static_parameters) })));
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.post('/', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].dataConnections.create(req.body);
        mainModel.reloadDataConnections(req.account.name);
        res.status(200).send();
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.put('/:id', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].dataConnections.update({ id: req.params.id, ...req.body });
        mainModel.reloadDataConnections(req.account.name);
    } catch (err) {
        return mainModel.sendErrToClient(res, err);
    }

    res.status(200).send();
});

router.delete('/:id', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].dataConnections.delete(req.params.id);
        mainModel.reloadDataConnections(req.account.name);
    } catch (err) {
        if (!isResourceNotFoundError(err)) {
            return mainModel.sendErrToClient(res, err);
        }
    }

    res.status(200).send();
});

router.get('/fhir/monaco-js-definitions/' , async (req, res) => {
    const data = fhirModel.getFhirDefinitions();
    res.status(200).send(data);
});

router.get('/fhir/rest-api' , async (req, res) => {
    const data = fhirModel.getFHIR3Definitions();
    res.status(200).send(data);
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
