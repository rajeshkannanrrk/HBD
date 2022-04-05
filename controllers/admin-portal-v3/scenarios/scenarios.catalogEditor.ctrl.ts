import * as fileUpload from 'express-fileupload';
import * as catalogEditorModel from "../../../models/admin-portal-v3/scenarios/scenarios.catalogEditor.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
const azure = require('azure-storage');
const express = require('express');
const config = require('config');
const rp = require('request-promise');
const auth = require("../../../modules/auth");
const UserRole = auth.UserRole;

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("catalogEditor");
    next();
});

router.get('/', async (req, res) => {
    if (req.userRole < UserRole.SystemAdmin) {
        mainModel.pageNotFound(req, res, "The page you requested does not exist");
    }
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/scenarios/scenarios.catalogEditor.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.post('/editOrAddTemplate', fileUpload({ useTempFiles: true }), async (req, res) => {
    if (req.userRole < UserRole.SystemAdmin) {
        return res.status(404).send("Request not found");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        const templateToEdit = JSON.parse(req.body.templateToEdit);
        const name = templateToEdit.name;
        const rk = templateToEdit.rk || null;
        const pk = !templateToEdit.pk || templateToEdit.pk === "builtincatalog" ?
            config.get('azure_storage.builtin_template_catalog_key') :
            templateToEdit.pk;

        const query = new azure.TableQuery().where("PartitionKey eq ?", pk);
        const existingTemplates = await mainModel.globalCosmosTableService.queryEntities('templateCatalog', query, null);
        const icon = req.files ? req.files.icon : null;
        const info = req.files ? req.files.infoImg : null;
        const sourceImg = req.files ? req.files.sourceImg : null;
        const templateContent = req.files ? req.files.templateContent : null;
        const errors = [];
        // find a template with same name, different rowKey
        if (existingTemplates.filter((template) => template.Name === name && template.RowKey !== rk ).length > 0) {
            errors.push("NAME_ALREADY_EXISTS");
        }
        // if the status is enabled, template file must exist
        if (templateToEdit.status === "Enabled" && templateContent == null) {
            const templateId: string = catalogEditorModel.getTemplateId(templateToEdit.pk, templateToEdit.rk);
            const doesTemplateFileExist: boolean = await catalogEditorModel.doesTemplateFileExist(templateId);
            if (!doesTemplateFileExist) {
                errors.push("STATUS_TEMPLATE_FILE_INCONSISTENCY");
            }
        }
        if (errors.length > 0) {
            throw new Error(JSON.stringify(errors));
        }
        const data = await catalogEditorModel.editOrAddTemplate(templateToEdit, icon, info, sourceImg, templateContent);
        res.status(200).send(data);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

// First use. TBR after V2
router.post('/createCatalogServerCreditTable', async (req, res) => {
    if (req.userRole < UserRole.SystemAdmin) {
        return res.status(404).send("Request not found");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        await catalogEditorModel.createCreditTable();
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);

    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
