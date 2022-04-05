import * as skillsModel from "../../../models/admin-portal-v3/integration/integration.skills.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { tenantContents } from "../../../modules/globals";
import * as rp from "request-promise";
import * as express from "express";
import { isResourceAlreadyExistsError, isResourceNotFoundError } from "healthbotcommon/tenantcontent";
import { UserRole } from "../../../modules/auth";
import { SkillInfo } from "healthbotcommon/tenantcontent";
import { errorHandlers, requireRole, requireSysAdminWriteMode } from "../../../middlewares/auth";

export const router = express.Router();

const requireEditorRole = requireRole(UserRole.Editor, errorHandlers.statusForbidden("Readers are not allowed for this operations"));
const requireAdminRole = requireRole(UserRole.Admin, errorHandlers.statusForbidden("Readers & Editors are not allowed for this operations"));

router.use((req, res, next) => {
    req._navigation_path.push("skills");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/integration/integration.skills.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.put('/consume/reset', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].registeredSkillsClient.purge();
        mainModel.reloadTenant(req.account.name);
        res.status(200).send();
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.put('/expose/reset', requireAdminRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await skillsModel.resetSkillExposureConfig(req.account, req.user.emails[0].value);
        res.status(200).send();
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.get('/consume/config', async (req, res) => {
    try {
        res.status(200).send({
            skills: await tenantContents[req.account.name].registeredSkillsClient.get(),
            appId: req.account.app_id
        });
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.get('/consume/fetchManifest', async (req, res) => {
    try {
        const data: SkillInfo = await fetchSkillManifest(decodeURIComponent(req.query.manifestUrl.toString()));
        res.status(200).send(data);
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.post('/consume/newSkill', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].registeredSkillsClient.create(req.body);
        mainModel.reloadTenant(req.account.name);
        res.status(200).send();
    } catch (err) {
        if (isResourceAlreadyExistsError(err)) {
            return mainModel.sendErrToClient(res, { statusCode: 400, message: 'Manifest already exists'});
        }
        mainModel.sendErrToClient(res, err);
    }
});

router.delete('/consume/registeredSkill', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await tenantContents[req.account.name].registeredSkillsClient.delete(req.query.manifestUrl as string);
        mainModel.reloadTenant(req.account.name);
    } catch (err) {
        if (!isResourceNotFoundError(err)) {
            return mainModel.sendErrToClient(res, err);
        }
    }
    res.status(200).send();
});

router.put('/consume/registeredSkill', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const data: SkillInfo = await fetchSkillManifest(decodeURIComponent(req.body.manifestUrl));
        await tenantContents[req.account.name].registeredSkillsClient.refresh(data);
        mainModel.reloadTenant(req.account.name);
        res.status(200).send();
    } catch (err) {
        if (isResourceNotFoundError(err)) {
            return mainModel.sendErrToClient(res, { statusCode: 400, message: 'Error while refreshing skill'});
        }
        mainModel.sendErrToClient(res, err);
    }
});

router.get('/expose/config', async (req, res) => {
    try {
        const data: skillsModel.ISkillExposureConfig = await skillsModel.getSkillExposureConfiguration(req.account);
        res.status(200).send(data);
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.get('/expose/manifest', async (req, res) => {
    try {
        const data: string = await skillsModel.getSkillManifestUrl(req.account);
        res.status(200).send(data);
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.post('/expose/config', requireAdminRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        await skillsModel.saveSkillConfiguration(req.account, req.body, req.user.emails[0].value, false);
        return res.sendStatus(200);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});


/**
 * Fetches the values from the provided manifest url, and creates SkillInfo based on it.
 *
 * @param manifestUrl - The url of the required manifest
 * @return - A promise resolved by a SkillInfo of the required manifest.
 */
async function fetchSkillManifest(manifestUrl: string): Promise<SkillInfo> {
    const response = await rp.get(manifestUrl, { json: true });
    if (!response.endpoints?.length || !response.endpoints[0].endpointUrl || !response.endpoints[0].msAppId) {
        throw new Error("Invalid manifest format");
    }
    return {
        manifestUrl,
        name: response.name ?? "",
        description: response.description ?? "",
        publisherName: response.publisherName ?? "",
        endpointUrl: response.endpoints[0].endpointUrl,
        msAppId: response.endpoints[0].msAppId
    };
}
