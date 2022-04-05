import * as fileUpload from 'express-fileupload';

import * as backupModel from "../../models/admin-portal-v3/backup-restore/backup.model";
import * as restoreModel from "../../models/admin-portal-v3/backup-restore/restore.model";
import * as mainModel from "../../models/admin-portal-v3/main.model";
import * as directline from "../../modules/directline";

import * as auth from "../../modules/auth";
import {router as analyticsController} from "./analytics.ctrl";
import {router as configurationController} from "./configuration.ctrl";
import {router as integrationController} from "./integration.ctrl";
import {router as languageModelsController} from "./language-models.ctrl";
import {router as localizationController} from "./language-models/localization.ctrl";
import {router as portalFeedbackController} from "./portal-feedbacks.ctrl";
import {router as resourcesController} from "./resources.ctrl";
import {router as scenarioEditorController} from "./scenario-editor.ctrl";
import {router as scenariosController} from "./scenarios.ctrl";
import {router as usersController} from "./users.ctrl";

const jwt = require('jsonwebtoken');
const express = require('express');
const moment = require('moment');
const UserRole = require("../../modules/auth").UserRole;

const pjson = require('../../package.json');
pjson.build = pjson.description.split('#')[1].trim();
if (pjson.build.length === 0) {
    pjson.build = 'local_' + Date.now();
}
export const router = express.Router();

router.use((req, res, next) => {
    if (req.originalUrl.substr(-1) === '/') {
        return res.redirect(301, req.originalUrl.substr(0, req.originalUrl.length - 1));
    }
    req._navigation_path = [];
    next();
});

router.get('/',  async (req, res) => {
    res.redirect('/account/' + req.account.name + "/scenarios/manage");
});

router.get('/plan', async (req, res) => {
    const data = await mainModel.getPlanDetails(req.account);
    res.status(200).send(data);
});

router.get('/webchatToken', async (req, res) => {
    try {
        const webchatToken = await directline.tokenFromSecret(req.account.webchat_secret);
        res.status(200).send(webchatToken);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/getDebugSessionJwt', (req, res) => {
    const debugSessionId: string = req.query.debugSessionId;
    const jwtResult = jwt.sign({userId: debugSessionId}, req.account.app_secret);
    res.status(200).send(jwtResult);
});

router.get('/sysadminReadonly', async (req, res) => {
    if (req.userRole < UserRole.SystemAdmin) {
        return res.status(200).send(false);
    }
    try {
        return res.status(200).send(auth.isSysadminReadOnly(req.user, req.account));
    }
    catch (error) {
        return res.status(200).send(false);
    }
});

router.get('/sysadminReadonly/toggle', async (req, res) => {
    if (req.userRole < UserRole.SystemAdmin) {
        return res.status(200).send(false);
    }
    try {
        return res.status(200).send(auth.sysadminReadonlyToggle(req.user, req.account));
    }
    catch (error) {
        return res.status(200).send(false);
    }
});

router.get('/backup', async (req, res) => {
    try {
        const isSystemAdmin: boolean = req.userRole === UserRole.SystemAdmin;
        const encrypt = !isSystemAdmin || !req.query.hasOwnProperty("json");
        const data = await backupModel.createBackup(req.account, req.user, encrypt, isSystemAdmin);
        res.setHeader("Content-disposition", `attachment; filename= ${moment().utc().format('YYYY-MM-DD_HH-mm-ss')}_${req.account.name}.${encrypt ? "hbs" : "json"}`);
        res.setHeader('Content-type', 'text/plain');
        res.status(200).send(data);
    }
    catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.post('/restore', fileUpload(), async (req, res) => {
    if (req.userRole < UserRole.Editor) {
        return res.status(403).send("Readers not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }

    try {
        const decrypt = req.userRole !== UserRole.SystemAdmin;
        const fileData = req.files.backup.data.toString();
        await restoreModel.restoreBackup(req.account, fileData, req.user, decrypt);
        return res.status(200).send();
    }
    catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.use('/analytics', analyticsController);
router.use('/configuration', configurationController);
router.use('/integration', integrationController);
router.use('/language-models', languageModelsController);
router.use('/localization', localizationController);
router.use('/resources', resourcesController);
router.use('/scenarios', scenariosController);
router.use('/users', usersController);
router.use('/scenario-editor', scenarioEditorController);
router.use('/portal-feedbacks', portalFeedbackController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
