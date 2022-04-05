import { Router } from 'express';
import * as fileUpload from 'express-fileupload';
import * as localizationModel from "../../../models/admin-portal-v3/language-models/configuration.localization.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import * as scenariosManageModel from "../../../models/admin-portal-v3/scenarios/scenarios.manage.model";
import * as scenariosValidationModel from "../../../models/admin-portal-v3/scenarios/scenarios.validation.model";
import { tenantContents } from '../../../modules/globals';
import { logLocalizationChange, logScenarioChange } from '../../../services/auditTrailsLogger';
import { LightScenario, Scenario } from "healthbotcommon/tenantcontent";
import { errorHandlers, requireRole, requireSysAdminWriteMode } from "../../../middlewares/auth";
import {ScenarioError} from "../../../models/admin-portal-v3/scenarios/scenarios.manage.model";
const _ = require('underscore');
const UserRole = require("../../../modules/auth").UserRole;

export const router = Router();

const requireEditorRole = requireRole(UserRole.Editor, errorHandlers.statusForbidden("Readers not allowed for this operations"));

router.use((req, res, next) => {
    req._navigation_path.push("manage");
    next();
});

enum ExportType {
    NATIVE = "native",
    ADAPTIVE_DIALOG = "obi"
}

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/scenarios/scenarios.manage.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/all', async (req, res) => {
    try {
        const accountScenarios: Array<Partial<LightScenario>> = await tenantContents[req.account.name].scenarios.listLightScenarios();
        if (req.query.builtin === "true") {
            const builtinScenarios = await scenariosManageModel.getBeginableBuiltinScenarios(req.account);
            for (const bis of builtinScenarios) {
                accountScenarios.push({name: bis, scenario_trigger: bis, active: true});
            }
        }
        // Sort the scenarios by scenario trigger
        const sortedScenarios = _.sortBy(accountScenarios, 'scenario_trigger');
        res.status(200).send(sortedScenarios);
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

router.get('/specificLocalizedStrings', async (req, res) => {
    try {
        const localizedStrings = await tenantContents[req.account.name].localization.custom.get();
        res.status(200).json(localizationModel.filterBySubstring(req.query.partOfString.toString(), localizedStrings));
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
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
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/export', async (req, res) => {
    try {
        if (req.body.names === undefined || req.body.names.length === 0) {
            res.status(400).send("empty list");
            return;
        }

        let scenarios: scenariosManageModel.IExportData[];
        let extension;
        switch (req.query.format) {
            case ExportType.NATIVE:
                scenarios = await scenariosManageModel.getExportJson(req.body.names, req.account);
                extension = "json";
                break;
            case ExportType.ADAPTIVE_DIALOG:
                scenarios = await scenariosManageModel.getExportOBIDialog(req.body.names, req.account);
                extension = "dialog";
                break;
            default:
                throw new Error("Unknown format type");
        }

        if (scenarios.length > 1) {
            scenariosManageModel.archiveAndSendScenarios(scenarios, res, extension);
        }
        else {
            const scenario = scenarios[0];
            res.setHeader("Content-disposition", `attachment; filename= ${scenario.scenarioId}.${extension}`);
            res.setHeader('Content-type', 'application/json');
            return res.status(200).send(JSON.stringify(scenario.data, undefined, ' '));
        }
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/import', fileUpload(), requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        if (req.files) {
            const scenarios = [];
            for (const [key, file] of Object.entries(req.files)) {
                if (Array.isArray(file)) {
                    throw new Error("Can't handle multiple files.");
                }

                const scenario = JSON.parse(String(file.data));
                if (req.body['active#' + key]) {
                    scenario.active = req.body['active#' + key] === "true";
                }
                scenarios.push(scenario);
            }
            await scenariosManageModel.importFromJson(scenarios, req.account, req.user);
            return res.sendStatus(200);
        }
        else {
            return res.status(400).send("no files were sent");
        }
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/:scenarioId/activeState', async (req, res) => {
    try {
        const activeState = (await tenantContents[req.account.name].scenarios.getLightScenario(req.params.scenarioId)).active;
        res.status(200).send(activeState);
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.post('/:scenarioId/activate', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const activeState = (await tenantContents[req.account.name].scenarios.getLightScenario(req.params.scenarioId)).active;
        if (!activeState) {
            await scenariosManageModel.activateScenario(req.account, req.params.scenarioId, req.user);
        }
        res.status(200).send();
    }
    catch (e) {
        if (Array.isArray(e) || e instanceof ScenarioError) {
            res.status(500).send(Array.isArray(e) ? e : [e]);
        } else {
            mainModel.sendErrToClient(res, e);
        }
    }
});

router.post('/:scenarioId/deactivate', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const activeState = (await tenantContents[req.account.name].scenarios.getLightScenario(req.params.scenarioId)).active;
        if (activeState) {
            await scenariosManageModel.deactivateScenario(req.account, req.params.scenarioId, req.user);
        }
        res.status(200).send();
    }
    catch (e) {
        if (Array.isArray(e) || e instanceof ScenarioError) {
            res.status(500).send(Array.isArray(e) ? e : [e]);
        } else {
            mainModel.sendErrToClient(res, e);
        }
    }
});

router.post('/delete', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        for (const id of req.body.ids) {
            const scenario: LightScenario = await tenantContents[req.account.name].scenarios.getLightScenario(id);
            await tenantContents[req.account.name].scenarios.deleteScenario(id);
            logScenarioChange(req.account.name, "deleted", req.user.emails[0].value, scenario.name, scenario.scenario_trigger);
        }
        mainModel.reloadScenario(req.account.name, "dummy_scenario_trigger", "dummy_scenario_trigger", false, undefined); // We pass dummy values since reloadScenario actually reloads the entire tenant.
        return res.status(200).send("Scenario Deleted");
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.post('/add', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const errors = [];
        if (!req.body.name || req.body.name.length === 0) {
            errors.push("name");
        }
        else if (!req.body.trigger || req.body.trigger.length === 0) {
            errors.push("trigger");
        }
        else if (req.body.trigger.search(/[^a-z,^A-Z,^0-9,^\/,^\\,^_]/) >= 0) {
            errors.push("trigger");             
        }
        else {
            const existingScenarios: LightScenario[] = await tenantContents[req.account.name].scenarios.listLightScenarios();
            if (existingScenarios.some((scenario) => scenario.name === req.body.name)) {
                errors.push("name");
            }
            if (existingScenarios.some((scenario) => scenario.scenario_trigger === req.body.trigger)) {
                errors.push("trigger");
            }
        }
        if (errors.length > 0) {
            throw new Error(JSON.stringify(errors));
        }
        const id = await scenariosManageModel.createNewScenario(req.account, req.user, req.body);
        res.status(200).send(id);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const scenario: any = await tenantContents[req.account.name].scenarios.getScenario(req.params.id);
        res.status(200).send({
            ...scenario,
            trigger: scenario.scenario_trigger
        });
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.put('/:id', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        // Check that name and trigger (ID) are not used by another scenario
        const [originalScenario, existingScenarios] = await Promise.all([tenantContents[req.account.name].scenarios.getLightScenario(req.params.id), tenantContents[req.account.name].scenarios.listLightScenarios()]);
        const errors: string[] = [];
        if (existingScenarios.filter((scenario) => scenario.name === req.body.name && scenario.name !== originalScenario.name).length > 0) { // User may edit a scenario without changing its name.
            errors.push("name");
        }
        if (existingScenarios.filter((scenario) => scenario.scenario_trigger === req.body.trigger && scenario.scenario_trigger !== originalScenario.scenario_trigger).length > 0) { // User may edit a scenario without changing its trigger.
            errors.push("trigger");
        }
        if (req.body.trigger.search(/[^a-z,^A-Z,^0-9,^\/,^\\,^_]/) >= 0) {
            errors.push("trigger");             
        }
        if (errors.length > 0) {
            throw new Error((JSON.stringify(errors)));
        }
        // Handle the request
        await scenariosManageModel.updateScenarioMetadata(req.account, req.params.id, req.body, req.user);
        res.status(200).send();
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

/**
 * Returns metadata containing suggested names and IDs.
 * Suggested name/ID includes the original name/ID + "copy(i)", where 'i' is the first avaiable index.
 */
router.get('/clone/:originalId', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    // Handle the request
    const originalID: string = req.params.originalId;
    // Now we need to update name and scenario_trigger to the suggested ones.
    // We will create 2 HashSets containing all the names and triggers of existing scenarios, and look for the first available index.
    const scenariosNames: Set<string> = new Set<string>();
    const scenariosTriggers: Set<string> = new Set<string>();
    let existingScenarios: any[];
    let originalScenario: any;
    try {
        [originalScenario, existingScenarios] = await Promise.all([
            tenantContents[req.account.name].scenarios.getLightScenario(originalID),
            tenantContents[req.account.name].scenarios.listLightScenarios(),
        ]);

    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
    originalScenario = {
        ...originalScenario,
        trigger: originalScenario.scenario_trigger
    };
    const originalScenarioName: string = originalScenario.name;
    const originalScenarioTrigger: string = originalScenario.scenario_trigger;
    for (const scenario of existingScenarios) {
        scenariosNames.add(scenario.name);
        scenariosTriggers.add(scenario.scenario_trigger);
    }
    // The following code finds the suggested name.
    if (!scenariosNames.has(originalScenarioName + "_copy")) { // Check if first possible name is available
        originalScenario.name = originalScenarioName + "_copy";
    }
    else { // name + '_copy' is not available - start enumeration until first available is caught
        let i = 1; // Initialization of index
        while (true) {
            if (!scenariosNames.has(originalScenarioName + "_copy_" + i)) { // If index is available
                originalScenario.name = originalScenarioName + "_copy_" + i;
                break;
            }
            else { // else, promote i
                i++;
            }
        }
    }
    // The following code finds the suggested trigger (ID).
    if (!scenariosTriggers.has(originalScenarioTrigger + "_copy")) { // Check if first possible trigger is available
        originalScenario.trigger = originalScenarioTrigger + "_copy";
    }
    else { // ID + '_copy' is not available - start enumeration until first available index is caught
        let i = 1; // Initialization of index
        while (true) {
            if (!scenariosTriggers.has(originalScenarioTrigger + "_copy_" + i)) { // If index is available
                originalScenario.trigger = originalScenarioTrigger + "_copy_" + i;
                break;
            }
            else { // else, promote i
                i++;
            }
        }
    }
    return res.status(200).send(originalScenario); // Return a response holding the original scenario properties, with the suggested name and trigger (ID).
});

/**
 * Handles POST requests used for cloning an existing scenario.
 */
router.post('/:id/clone', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    // Check that name and trigger are not used by another scenario
    const errors: string[] = [];
    let existingScenarios: any[];
    try {
        existingScenarios = await tenantContents[req.account.name].scenarios.listLightScenarios();
        if (existingScenarios.some((scenario) => scenario.name === req.body.name)) {
            errors.push("name");
        }
        if (existingScenarios.some((scenario) => scenario.scenario_trigger === req.body.trigger)) {
            errors.push("trigger");
        }
        if (errors.length > 0) {
            throw new Error((JSON.stringify(errors)));
        }
        // If all checks passed - handle the request
        const id: string = await scenariosManageModel.cloneExistingScenario(req.account, req.params.id, req.body, req.user);
        res.status(200).send(id);
    }
    catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.post('/validatescenarioimport', fileUpload(), async (req, res) => {
    if (req.files) {
        let importedScenarios;
        try {
            importedScenarios = scenariosManageModel.scenarioFilesToObjects(req.files);
        } catch (err) {
            return res.status(200).send(err);
        }

        const schemeOnly = req.body.schemeOnly && (req.body.schemeOnly.toLowerCase() === "true");
        if (!schemeOnly) {
            importedScenarios = await scenariosValidationModel.validateImportScenarios(req.account, importedScenarios);
        }
        const result = {};
        for (const scenario of importedScenarios) {
            result[scenario.name] = {
                valid: scenario.valid,
                message: scenario.message,
                severity: scenario.severity
            };
        }
        return res.status(200).send(result);
    } else {
        res.status(200).send({});
    }
});

router.post('/validatescenario', async (req, res) => {
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

/**
 * Create a snapshot
 */
router.post('/snapshot/:id', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const snapshot = await scenariosManageModel.createSnapshot(req.params.id, req.account, req.user);
        return res.status(200).send({ snapshot });
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

/**
 * Get list of snapshot for a scenario
 */
router.get('/snapshot/:id', async (req, res) => {
    try {
        const snapshots = await tenantContents[req.account.name].scenarios.getSnapshotsNames(req.params.id);
        return res.status(200).send(snapshots);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

/**
 * Delete one snapshot of a scenario
 */
router.delete('/snapshot/:id/:snapshotId', async (req, res) => {
    try {
        await scenariosManageModel.deleteSnapshot(req.params.id, req.params.snapshotId, req.account, req.user);
        return res.sendStatus(200);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

/**
 * Promote a snapshot to the base blob
 */
router.post('/snapshot/promote/:id/:snapshotId', requireEditorRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        if (req.query.snapshot === 'true') {
            // Make snapshot before promoting
            await scenariosManageModel.createSnapshot(req.params.id, req.account, req.user);
        }
        // Copy the snapshot blob over to the base blob
        const result = await scenariosManageModel.copySnapshot(req.params.id, req.params.snapshotId, req.account, req.user);
        return res.status(200).send(result);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/snapshot/compare/:id/:snapshotId', async (req, res) => {
    try{
        const response = await scenariosManageModel.getSnapshotAndSnapshotCode(req.params.id, req.params.snapshotId, undefined, req.account);
        return res.status(200).send(response);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/snapshot/code/:id/:snapshotId', async (req, res) => {
    try{
        const response = await tenantContents[req.account.name].scenarios.getSnapshotCode(req.params.id, req.params.snapshotId);
        return res.status(200).send(response);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.get('/snapshot/compare/:id/:snapshotId1/:snapshotId2', async (req, res) => {
    try{
        const response = await scenariosManageModel.getSnapshotAndSnapshotCode(req.params.id, req.params.snapshotId1, req.params.snapshotId2, req.account);
        return res.status(200).send(response);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
