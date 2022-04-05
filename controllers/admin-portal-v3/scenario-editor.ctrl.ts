import { Router } from "express";
import { Logger } from "healthbotcommon/logger";
import { defaultLocalizationClient, mergeLocalizationObjects } from "healthbotcommon/tenantcontent/localization";
import { isResourceNotFoundError, LightScenario } from "healthbotcommon/tenantcontent";
import * as localizationModel from "../../models/admin-portal-v3/language-models/configuration.localization.model";
import * as languageConfigurationModel from "../../models/admin-portal-v3/language-models/language-models.manage.model";
import * as mainModel from "../../models/admin-portal-v3/main.model";
import * as scenariosManageModel from "../../models/admin-portal-v3/scenarios/scenarios.manage.model";
import * as scenariosValidationModel from "../../models/admin-portal-v3/scenarios/scenarios.validation.model";
import { tenantContents } from "../../modules/globals";
import { logLocalizationChange } from "../../services/auditTrailsLogger";
import {ScenarioError} from "../../models/admin-portal-v3/scenarios/scenarios.manage.model";

const config = require('config');
const moment = require('moment');
const auth = require('../../modules/auth');
const UserRole = require("../../modules/auth").UserRole;

const logger = Logger.getInstance();

export const router = Router();

router.get('/state', async (req, res) => {
    try {
        const scenarioDefinition: LightScenario = await tenantContents[req.account.name].scenarios.getLightScenario(req.query.id.toString());
        res.status(200).send(scenarioDefinition.active);
    }
    catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.get('/specificLocalizedStrings', async (req, res) => {
    try {
        const localizedStrings = await tenantContents[req.account.name].localization.custom.get();
        res.status(200).json(localizationModel.filterBySubstring(req.query.partOfString.toString(), localizedStrings));
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/localizationSettings', async (req, res) => {
    try {
        const settings = (await tenantContents[req.account.name].config.load()).get("localizationSettings");
        res.status(200).json(settings);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/localizationStrings', async (req, res) => {
    try {
        const [systemLocalizedStrings, customLocalizedStrings] = await Promise.all([
            tenantContents[req.account.name].localization.system.get(),
            tenantContents[req.account.name].localization.custom.get()
        ]);

        const mergedLocalizedStrings = mergeLocalizationObjects(defaultLocalizationClient.get(), systemLocalizedStrings);

        res.status(200).json({ mergedLocalizedStrings, customLocalizedStrings });
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/luismodels', async (req, res) => {
    const data = {
        luisModels: await languageConfigurationModel.getLuisModels(req.account.name),
        luisURL: config.get('luis.url_format')
    };
    if (config.get('luis.disable_logging')) {
        data.luisURL += config.get('luis.log_disabling_parameter');
    }
    try {
        res.status(200).send(data);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/skills', async (req, res) => {
    try {
        const data = {
            skills: (await tenantContents[req.account.name].registeredSkillsClient.get()).map((skillEntity) => ({
                name: skillEntity.name,
                manifestUrl: skillEntity.manifestUrl
            }))
        };
        res.status(200).send(data);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/:id', async (req, res) => {
    if (req.url.substr(-1) === '/') {
        return res.redirect(301, req.url.substr(0, req.url.length - 1));
    }
    if (!req.params.id) {
        return res.render('admin-portal-v3/error', {accountName: req.account.name, error: "Page not available"});
    }
    try {
        const pageData: any = await mainModel.getData(req);
        pageData.scenarioId = req.params.id;
        res.render('scenario-editor-v3/scenario-editor', pageData);
    }
    catch (error) {
        return res.render('admin-portal-v3/error', {accountName: req.account.name, error: "The specific scenario does not exists or not available at the moment."});
    }
});

router.get('/:id/code', async (req, res) => {
    if (req.url.substr(-1) === '/') {
        return res.redirect(301, req.url.substr(0, req.url.length - 1));
    }
    const id = req.params.id;
    if (!id) {
        return mainModel.sendErrToClient(res, {});
    }
    try {
        const { code, ...scenario } = await tenantContents[req.account.name].scenarios.getScenario(id);
        const result = {
            metadata: {
                lastModified: moment.utc(scenario.updated),
                active: scenario.active,
                scenario_trigger: scenario.scenario_trigger,
                name: scenario.name,
                description: scenario.description
            },
            code
        };
        try {
            res.status(200).send(result);
        } catch (e) {
            mainModel.sendErrToClient(res, e);
        }
    }
    catch (error) {
        if (isResourceNotFoundError(error)) {
            logger.error(null, `Failed loading scenario in scenario editor, scenario blob is missing. Tenant name: ${req.account.name} Scenario id: ${id} Error: ${error}`);
        }
        mainModel.sendErrToClient(res, error);
    }
});

router.put('/:id', async (req, res) => {
    if (req.userRole < UserRole.Editor) {
        return res.status(403).send("Readers not allowed for this operations");
    }
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        const baseUrl = `${req.protocol}://${req.header("host")}`;
        await scenariosManageModel.updateScenarioCode(req.account, req.params.id, req.body.code, req.body.deactivate, req.user, baseUrl);
        res.status(200).send();
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/validate', async (req, res) => {
    const body = req.body.code;
    const id = req.body.id;
    const name = req.body.name;
    const trigger = req.body.trigger;
    const justLoaded = req.body.justLoaded;

    let errors = [];
    try {
        await scenariosValidationModel.validateScenario(id, req.account, name, trigger, body, justLoaded);
    } catch (e) {
        if (Array.isArray(e) || e instanceof ScenarioError) {
            errors = Array.isArray(e) ? e : [e];
        } else {
            return mainModel.sendErrToClient(res, e);
        }
    }
    res.status(200).send(errors);
});

router.post('/saveNewString', async (req, res) => {
    try {
        const { value } = req.body;
        const stringId = localizationModel.getStringId(value);

        await tenantContents[req.account.name].localization.custom.saveChanges([{
            stringId,
            "en-us": value
        }]);

        mainModel.updateLocalizationSettings(req.account.name);
        mainModel.reloadTenant(req.account.name);
        logLocalizationChange(req.account.name, "modified", req.user.emails[0].value, "custom");

        res.status(200).json({
            "string Id": stringId,
            "en-us": value
        });
    }
    catch (error) {
        mainModel.sendErrToClient(res, {});
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
