import { Router } from "express";
import { defaultLocalizationClient, mergeLocalizationObjects } from "healthbotcommon/tenantcontent/localization";
import { errorHandlers, requireRole, requireSysAdminWriteMode } from "../../../middlewares/auth";
import * as localizationModel from "../../../models/admin-portal-v3/language-models/configuration.localization.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole } from "../../../modules/auth";
import { tenantContents } from "../../../modules/globals";
import { logLocalizationChange } from "../../../services/auditTrailsLogger";

export const router = Router();

const requireEditorRole = requireRole(UserRole.Editor, errorHandlers.statusForbidden("Readers not allowed for this operations"));
const getLocalizationSettings = (accountName) => tenantContents[accountName].config.load().then((tenantConfig) => tenantConfig.get("localizationSettings"));

router.use((req, _, next) => {
    req._navigation_path.push("localization");
    next();
});

router.get('/', async (req, res) => {
    try {
        const [data, { isLocalizationEnabled }] = await Promise.all([
            mainModel.getData(req),
            getLocalizationSettings(req.account.name)
        ]);
        const localesObject: any = localizationModel.allLocales; // Get the json holding locales keys mapped to relevant locales representations.
        res.render('admin-portal-v3/configuration/configuration.localization.ejs', {...data, isLocalizationEnabled, localesObject});
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/locales', async (req, res) => {
    try {
        const locales = await Promise.all([
            tenantContents[req.account.name].localization.system.getLocales(),
            tenantContents[req.account.name].localization.custom.getLocales()
        ]);

        res.status(200).json([...new Set(locales.flat().concat(defaultLocalizationClient.getLocales()))]);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/localizedStrings', async (req, res) => {
    try {
        const [localizedStrings, settings] = await Promise.all([
            getLocalizedStrings(req.account.name),
            getLocalizationSettings(req.account.name)
        ]);

        res.status(200).json({ localizedStrings, settings });
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/localizedStrings', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    const normalizeStringId = (obj) => Object.fromEntries(Object.entries(obj).map(([key, value]) => [key.toLowerCase() === "string id" ? "stringId" : key, value]));

    try {
        const { system, custom } = req.body;
        
        if (system && system.length > 0) {
            await tenantContents[req.account.name].localization.system.saveChanges(system.map(normalizeStringId));
            logLocalizationChange(req.account.name, "modified", req.user.emails[0].value, "system");
        }

        if (custom && custom.length > 0) {
            await tenantContents[req.account.name].localization.custom.saveChanges(custom.map(normalizeStringId));
            logLocalizationChange(req.account.name, "modified", req.user.emails[0].value, "custom");
        }

        mainModel.updateLocalizationSettings(req.account.name);
        mainModel.reloadTenant(req.account.name);

        return res.sendStatus(201);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/localizedStrings/from-scenarios', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const localizedStrings = await localizationModel.getLocalizedStringsFromScenarios(req.account.name, req.account.id);

        return res.status(200).json({ localizedStrings, status: "OK" });
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.delete('/localizedStrings/:localizationType', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        if (!["system", "custom"].includes(req.params.localizationType)) {
            throw new Error(`localization type ${req.params.localizationType} is not supported.`);
        }

        const localizationClient = req.params.localizationType === "system" ?
            tenantContents[req.account.name].localization.system :
            tenantContents[req.account.name].localization.custom;

        await localizationClient.purge();

        mainModel.reloadTenant(req.account.name);
        logLocalizationChange(req.account.name, "deleted", req.user.emails[0].value, req.params.localizationType);
        
        const localizedStrings = await getLocalizedStrings(req.account.name);

        return res.status(200).json({ localizedStrings, status: "OK" });
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/settings', async (req, res) => {
    try {
        const languagesJsonObject: any = localizationModel.allLocales;
        const settings = await getLocalizationSettings(req.account.name);

        res.status(200).json({ settings, languagesJsonObject });
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/settings', requireRole(UserRole.Editor, errorHandlers.statusForbidden("Operation is not allowed for reader user.")), requireSysAdminWriteMode(), async (req, res) => {
    try {
        const tenantConfig = await tenantContents[req.account.name].config.getOverrides();

        tenantConfig.localizationSettings = req.body;

        await tenantContents[req.account.name].config.save(tenantConfig);
        mainModel.reloadTenant(req.account.name);
        logLocalizationChange(req.account.name, "modified", req.user.emails[0].value, "settings");
        // await localizationModel.saveLocalizationSettings(req.account.name, req.account.id, req.user.emails[0].value, localizationSettings);
        return res.status(200).json({status: "OK"});
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

async function getLocalizedStrings(accountName: string) {
    const defaultLocalizedStrings = defaultLocalizationClient.get();
    const [systemLocalizedStrings, customLocalizedStrings] = await Promise.all([
        tenantContents[accountName].localization.system.get(),
        tenantContents[accountName].localization.custom.get(),
    ]);

    return {
        defaultLocalizedStrings,
        systemLocalizedStrings,
        customLocalizedStrings,
        mergedLocalizedStrings: mergeLocalizationObjects(systemLocalizedStrings, defaultLocalizedStrings)
    };
}
