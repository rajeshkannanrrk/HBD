import { Router } from "express";
import * as fileUpload from 'express-fileupload';
import { errorHandlers, requireRole, requireSysAdminWriteMode } from "../../../middlewares/auth";
import * as channelsModel from "../../../models/admin-portal-v3/integration/integration.channels.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole } from "../../../modules/auth";
import { tenantContents } from "../../../modules/globals";
const auth = require('../../../modules/auth');

export const router = Router();

router.use((req, _, next) => {
    req._navigation_path.push("channels");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data: any = await mainModel.getData(req);
        if (!data.botName) {
            mainModel.pageNotFound(req, res, "Bot registration resource was not found");
        }
        else {
            res.render('admin-portal-v3/integration/integration.channels.ejs', data);
        }
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/channel/read', async (req, res) => {
    try {
        const data = await channelsModel.readChannels(req.account);
        res.status(200).send(data);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/channel/:channelName', async (req, res) => {
    if (req.userRole < UserRole.Admin) {
        return res.status(403).send("Readers & Editors are not allowed for this operation");
    }
    try {
        const data = await channelsModel.getChannel(req.account, req.params.channelName);
        res.status(200).send(data);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.delete('/channel/:channelName', async (req, res) => {
    if (req.userRole < UserRole.Admin) {
        return res.status(403).send("Readers & Editors are not allowed for this operation");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        await channelsModel.deleteChannel(req.account, req.user, req.params.channelName);
        res.status(200).send('deleted');
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/channel/:channelName', async (req, res) => {
    if (req.userRole < UserRole.Admin) {
        return res.status(403).send("Readers & Editors are not allowed for this operation");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        await channelsModel.createChannel(req.account, req.user, req.params.channelName, req.body);
        res.status(201).send(req.body);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.put('/channel/:channelName', async (req, res) => {
    if (req.userRole < UserRole.Admin) {
        return res.status(403).send("Readers & Editors are not allowed for this operation");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        await channelsModel.modifyChannel(req.account, req.user, req.params.channelName, req.body);
        res.status(201).send(req.body);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/botIcon/read', async (req, res) => {
    try {
        const data = await channelsModel.readBotProperties(req.account);
        res.status(200).send({iconUrl: data.properties.iconUrl});
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/botIcon/upload', requireRole(UserRole.Admin, errorHandlers.statusForbidden("Readers & Editors are not allowed for this operation")), requireSysAdminWriteMode(), fileUpload({ useTempFiles: true }), async (req, res) => {
    try {
        const file = req.files.icon;

        if (Array.isArray(file)) {
            return res.status(400).send("Can't upload multiple files");
        }

        const iconUrl = await tenantContents[req.account.name].resources.upload(file.name, file.tempFilePath, { blobContentType: file.mimetype, blobContentEncoding: file.encoding });

        await channelsModel.updateBotIcon(req.account, req.user.emails[0].value, iconUrl, file.name);

        res.status(200).send();
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);

    }
});
