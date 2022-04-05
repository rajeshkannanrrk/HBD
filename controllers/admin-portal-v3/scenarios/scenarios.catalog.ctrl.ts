import * as config from 'config';
import * as catalogModel from "../../../models/admin-portal-v3/scenarios/scenarios.catalog.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
const express = require('express');
const UserRole = require("../../../modules/auth").UserRole;
import * as auth from "../../../modules/auth";
export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("catalog");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/scenarios/scenarios.catalog.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/templates' , async (req, res) => {
    try {
        const data = await catalogModel.getTemplates();
        res.status(200).send(data);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/importFromCatalog' , async (req, res) => {
    if (req.userRole < UserRole.Editor) {
        return res.status(403).send("Readers not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        const catalogId: string = req.query.catalogId;
        const templateId: string = req.query.templateId;
        const templateIdPattern = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');
        if (catalogId !== config.get('azure_storage.builtin_template_catalog_key') || !templateIdPattern.test(templateId)) {
            throw new Error();
        }
        
        const customFields = JSON.parse(req.query.customFields);
        const data = await catalogModel.importFromCatalog(req.query.templateId, req.query.catalogId, customFields, req.user.displayName, req.account, req.user);
        res.status(200).send(data);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
