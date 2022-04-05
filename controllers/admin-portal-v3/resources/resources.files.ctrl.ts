import { Router } from 'express';
import * as fileUpload from 'express-fileupload';
import { errorHandlers, requireRole, requireSysAdminWriteMode } from '../../../middlewares/auth';
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole } from '../../../modules/auth';
import { tenantContents } from '../../../modules/globals';

export const router = Router();

const requireEditorRole = requireRole(UserRole.Editor, errorHandlers.statusForbidden("Readers not allowed for this operations"));

router.use((req, _, next) => {
    req._navigation_path.push("files");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);

        res.render('admin-portal-v3/resources/resources.files.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/all', async (req, res) => {
    const data = await tenantContents[req.account.name].resources.getAll();

    res.status(200).send(data);
});

router.post('/upload', requireEditorRole, requireSysAdminWriteMode(), fileUpload({ useTempFiles: true }), async (req, res) => {
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
        const pr = tenantContents[req.account.name].resources.upload(file.name, file.tempFilePath, { blobContentType: file.mimetype, blobContentEncoding: file.encoding });
        promises.push(pr);
    }

    try {
        await Promise.all(promises);

        res.status(200).send();
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.delete('/delete', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    const { entries: existingFiles } = await tenantContents[req.account.name].resources.getAll();

    if (existingFiles.indexOf(req.query.name.toString()) === -1) {
        return res.status(404).send(`Requested blob '${req.query.name}' not found`);
    }

    try {
        await tenantContents[req.account.name].resources.delete(req.query.name.toString());

        res.status(200).send();
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
