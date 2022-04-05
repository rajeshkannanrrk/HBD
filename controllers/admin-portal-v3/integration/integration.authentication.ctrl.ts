import { Router } from "express";
import { isResourceNotFoundError } from "healthbotcommon/tenantcontent";
import { errorHandlers, requireRole, requireSysAdminWriteMode } from "../../../middlewares/auth";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole } from "../../../modules/auth";
import { tenantContents } from "../../../modules/globals";

export const router = Router();

const requireEditorRole = requireRole(UserRole.Editor, errorHandlers.statusForbidden("Readers not allowed for this operations"));

router.use((req, _, next) => {
    req._navigation_path.push("authentication");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/integration/integration.authentication.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/read', async (req, res) => {
    try {
        const authProviders = await tenantContents[req.account.name].authProviders.getAll();
        res.status(200).send(authProviders);
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.post('/', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].authProviders.create(req.body);
        mainModel.reloadDataConnections(req.account.name);
        res.status(200).send();
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.put('/:id', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].authProviders.update({ ...req.body, id: req.params.id });
        mainModel.reloadDataConnections(req.account.name);
        res.status(200).send();
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.delete('/:id', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].authProviders.delete(req.params.id);
        mainModel.reloadDataConnections(req.account.name);
    } catch (err) {
        if (!isResourceNotFoundError(err)) {
            return mainModel.sendErrToClient(res, err);
        }
    }

    res.status(200).send();
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
