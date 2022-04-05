import { Router } from "express";
import { defaultLocalizationClient, mergeLocalizationObjects } from "healthbotcommon/tenantcontent/localization";
import * as localizationModel from "../../../models/admin-portal-v3/language-models/configuration.localization.model";
import * as languageModelsModel from "../../../models/admin-portal-v3/language-models/language-models.manage.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { tenantContents } from "../../../modules/globals";
const auth = require('../../../modules/auth');
const UserRole = require("../../../modules/auth").UserRole;


export const router = Router();

router.use((req, res, next) => {
    req._navigation_path.push("manage");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/language-models/language-models.manage.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/read', async (req, res) => {
    try {
        const data = await languageModelsModel.read(req.account);
        res.status(200).send(data);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.delete('/reset', async (req, res) => {
    if (req.userRole < UserRole.Editor) {
        return res.status(403).send("Readers not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        const model = await languageModelsModel.resetModels(req.account.name, req.user.emails[0].value);
        res.status(200).send(model);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/model', async (req, res) => {
    if (req.userRole < UserRole.Editor) {
        return res.status(403).send("Readers not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        const model = await languageModelsModel.createNewModel(req.account.id, req.account.name, req.user.emails[0].value, req.body);
        res.status(200).send(model);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.put('/model', async (req, res) => {
    if (req.userRole < UserRole.Editor) {
        return res.status(403).send("Readers not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        const model = await languageModelsModel.saveModel(req.account.id, req.account.name, req.user.emails[0].value, req.body);
        res.status(200).send(model);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/model/delete', async (req, res) => {
    if (req.userRole < UserRole.Editor) {
        return res.status(403).send("Readers not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        const model = await languageModelsModel.deleteModel(req.account.name, req.user.emails[0].value, req.body);
        res.status(200).send(model);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.put('/model/update', async (req, res) => {
    if (req.userRole < UserRole.Admin) {
        return res.status(403).send("Readers and Editors not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        const model = await languageModelsModel.updateQnaModel(req.account.id, req.account.name, req.body);
        res.status(200).send(model);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/toggleEnabled', async (req, res) => {
    if (req.userRole < UserRole.Editor) {
        return res.status(403).send("Readers not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        await languageModelsModel.toggleEnabled(req.account.name, req.user.emails[0].value, req.body);
        res.sendStatus(200);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/specificLocalizedStrings', async (req, res) => {
    try {
        const systemLocalizedStrings = await tenantContents[req.account.name].localization.system.get();
        const localizedStrings = mergeLocalizationObjects(defaultLocalizationClient.get(), systemLocalizedStrings);

        res.status(200).json(localizationModel.filterBySubstring(req.query.partOfString.toString(), localizedStrings));
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
