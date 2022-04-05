import { Logger } from 'healthbotcommon/logger';
const logger = Logger.getInstance();
import { HealthBotUtils } from "healthbotcommon/healthbotutils";
import { validateScenarioCircularity } from "../../../modules/scenarioCycleDetection";
import {
    getBeginableBuiltinScenarios,
    ScenarioError,
    ScenarioErrorSeverity,
    scenarioStringToObject
} from "./scenarios.manage.model";
import { tenantContents } from "../../../modules/globals";
import { LightScenario } from "healthbotcommon/tenantcontent";

const config = require('config');
const Validator = require('jsonschema').Validator;
const internalJsonValidator = new Validator();
const schema = require('../../../validateschema.json');

export const jsonValidator = (code) => internalJsonValidator.validate(code, schema);
export async function validateImportScenarios(account, importedScenariosList) {
    let openedScenarios;
    const triggerToScenario = {};
    // setup loop
    for (const scenario of importedScenariosList) {
        scenario.validated = false;
        triggerToScenario[scenario.scenario_trigger] = scenario;
    }

    // actual validation loop
    for (const scenario of importedScenariosList) {
        if (scenario.validated) {
            continue;
        }
        openedScenarios = [];
        try {
            // TODO: Validation of subscenario was removed due to performance issues. Check only current scenario.
            // This check needs to be restored in the future
            await validateScenarioCircularity(scenario.name, scenario.body, /* loadSubScenarioCodeFromImportAndFromAzure */ dummySubScenarioWithPrompt);
            // mark all imported sub scenarios as valid as well (they must be)
            for (const openedScenario of openedScenarios) {
                openedScenario.validated = true;
                openedScenario.valid = true;
                openedScenario.severity = -1;
                openedScenario.message = "";
            }
        } catch (err) {
            scenario.valid = false;
            scenario.severity = err.severity;
            scenario.message = err.message;
        }
        scenario.validated = true;
    }

    return importedScenariosList;

    // load function to merge the imported scenarios into the existing list.
    async function loadSubScenarioCodeFromImportAndFromAzure(trigger) {
        const triggeredScenario = triggerToScenario[trigger];
        if (triggeredScenario) {
            openedScenarios.push(triggeredScenario);
            return triggeredScenario.code;
        }
        return loadScenarioCode(account, trigger);
    }
}

export async function validateScenario(id: string, account, name: string, scenarioTrigger: string, body, justLoaded: boolean) {
    if (!name && !justLoaded) {
        throw new ScenarioError("Name is not defined");
    }
    if (!scenarioTrigger && !justLoaded) {
        throw new ScenarioError("Scenario Trigger is not defined");
    }

    // verify no other scenario already exists by that name or trigger
    let entities: LightScenario[];
    try {
        entities = await tenantContents[account.name].scenarios.listLightScenarios();
        if (!id) {
            entities = entities.filter((scenario) => (scenario.name === name || scenario.scenario_trigger === scenarioTrigger));
        }
        else {
            entities = entities.filter((scenario) => (scenario.RowKey !== id && (scenario.name === name || scenario.scenario_trigger === scenarioTrigger)));
        }
    } catch (err) {
        throw new ScenarioError("Failed to read scenarios list: " + err.message);
    }
    if (entities && entities.length > 0) {
        throw new ScenarioError("Scenario with this name or this trigger already exists");
    }

    if (!validateScenarioId(scenarioTrigger)) {
        throw new ScenarioError("Illegal scenario id. Only letters, numbers and underscores are allowed.");
    }

    const jsoncode = validateScenarioScheme(body);
    jsoncode.name = scenarioTrigger;

    // Validate that scenario size, as a string, doesn't exceed allowed length.
    let maxAllowedScenarioSize: number = config.get("bot.scenario_size_soft_limit_in_bytes");
    // Check blob size before tenant's change
    const scenarioCodeJson: string = JSON.stringify((await tenantContents[account.name].scenarios.getScenario(id)).code);
    if (scenarioCodeJson.length > maxAllowedScenarioSize) { // If scenario is already bigger than what we allow (i.e. the soft limit).
        maxAllowedScenarioSize = config.get("bot.scenario_size_hard_limit_in_bytes"); // Then we will allow it to grow up to the hard limit.
    }
    const sizeToBeSaved: number = JSON.stringify(JSON.parse(body)).length; // JSON.stringify(JSON.parse(body)) ensures that body size will be equal to blob size.
    if (sizeToBeSaved > maxAllowedScenarioSize) {
        logger.eventWithCustomFields("ScenarioMaxSizeExceeded", {tenant: account.name, scenario: name});
        throw new ScenarioError("The scenario you are saving is too large. If you are storing large JSON objects in the scenario file, you should store them as an external resource and retrieve them dynamically at run time. You can read more about resources here: <a href='https://docs.microsoft.com/en-us/HealthBot/tenant-resources' style='text-decoration:underline;'> https://docs.microsoft.com/en-us/HealthBot/tenant-resources");
    }

    // TODO: Validation of subscenario was removed due to performance issues. Check only current scenario.
    // This check needs to be restored in the future
    await validateScenarioCircularity(name, jsoncode, /* loadSubScenarioCodeFromAzure */ dummySubScenarioWithPrompt );

    async function loadSubScenarioCodeFromAzure(trigger) {
        return loadScenarioCode(account, trigger);
    }
}

export function validateScenarioId(scenarioId: string): boolean {
    // trigger word can contain english letters, numbers, underscore and slash (fw and bw) only !
    return scenarioId.search(/[^a-z,^A-Z,^0-9,^\/,^\\,^_]/) < 0;
}

function dummySubScenarioWithPrompt(trigger) {
    return JSON.stringify({
        name: trigger,
        version: 2,
        steps: [{
            id: "b689adb9456a-5d86899c3a99d122-4fcb",
            type: "prompt",
            dataType: "boolean",
            designer: {
                xLocation: 649,
                yLocation: 276
            },
            text: "dummy",
            variable: "dummy"
        }]
    });
}

export function validateScenarioScheme(body) {
    let jsoncode;
    try {
        jsoncode = JSON.parse(body);
    } catch (e) {
        throw new ScenarioError(e.message);
    }
    const result = jsonValidator(jsoncode);
    if (result.errors.length > 0) {
        const errs = [];
        result.errors.forEach((e) => {
            errs.push(new ScenarioError(e.message));
        });
        throw errs;
    }
    return jsoncode;
}

export async function validateAPIimport(scenarios, account) {
    // step 1 - validate structure and  scheme
    let importedScenarios = [];
    for (const scenario of scenarios) {
        importedScenarios.push(scenarioStringToObject(scenario.name, scenario));
    }
    const errs = [];
    for (const scenario of importedScenarios) {
        if (!scenario.valid) {
            errs.push(scenario.message);
        }
    }
    if (errs.length > 0) {
        throw errs;
    }

    // step 2 - validate circularity. deactivating scenarios with problems or warnings.
    importedScenarios = await validateImportScenarios(account, importedScenarios);
    for (const scenario of importedScenarios) {
        if (scenario.severity === ScenarioErrorSeverity.problem || scenario.severity === ScenarioErrorSeverity.warning) {
            scenario.active = false;
        }
    }
    return importedScenarios;
}

async function loadScenarioCode(account, trigger) {
    const builtinScenarioTriggers = await getBeginableBuiltinScenarios(account);
    if (builtinScenarioTriggers.indexOf(trigger) >= 0) {
        return JSON.stringify({
            name: trigger,
            version: 2,
            steps: []
        });
    }

    let entities;
    try {
        entities = (await tenantContents[account.id].scenarios.listLightScenarios()).filter((scenario) => scenario.scenario_trigger === trigger);
    } catch (err) {
        throw new ScenarioError("Failed to read scenario " + trigger + ": " + err.message);
    }
    if (!entities || entities.length === 0) {
        throw new ScenarioError("Failed to find scenario '" + trigger + "'", ScenarioErrorSeverity.problem);
    }
    if (entities.length > 1) {
        throw new ScenarioError("Scenario trigger name '" + trigger + "' is ambiguous. it must be unique", ScenarioErrorSeverity.problem);
    }
    const scenario = entities[0];
    if (!scenario.active) {
        throw new ScenarioError("Call to inactive scenario '" + trigger + "' is not valid", ScenarioErrorSeverity.problem);
    }
    const jsonBlobName = HealthBotUtils.getScenarioBlobName(account.name, scenario.RowKey);
    let text;
    try {
        text = JSON.stringify((await tenantContents[account.name].scenarios.getScenario(scenario.RowKey)).code);
    } catch (err) {
        throw new ScenarioError("Failed to read scenario " + trigger + ": " + err.message);
    }
    if (!text || text.length === 0) {
        throw new ScenarioError("Scenario json blob " + jsonBlobName + " is empty", ScenarioErrorSeverity.problem);
    }
    return text;
}
