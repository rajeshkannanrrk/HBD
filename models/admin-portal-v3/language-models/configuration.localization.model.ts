import { Logger } from 'healthbotcommon/logger';
import * as mainModel from "../main.model";
import { tenantContents } from "../../../modules/globals";
import { LocalizationObject } from 'healthbotcommon/tenantcontent';

const crypto = require('crypto');
const azure = require('azure-storage');
const logger = Logger.getInstance();

const defaultLocaleColumnName = "en_us";

export const allLocales: any = require('./allLocales.json');

export function filterBySubstring(substring: string, localization: LocalizationObject) {
    return localization.stringIds
        .map((stringId) => ({ stringId, "en-us": localization["en-us"][stringId] }))
        .filter(({ "en-us": translation }) => translation?.toLowerCase().includes(substring.toLowerCase()));
}

export function getStringId(text, defaultStringId = "stringId") {
    const textHash = crypto.createHash('md5').update(text).digest('hex');
    return `${defaultStringId}_${textHash.substr(0, 16)}`;
}

async function getScenariosStrings(scenario, scenarioInfo, accountName, localizedStrings) {
    const texts = new Set();
    function addText(text) {
        const stringId = `${scenarioInfo.scenario_trigger}_${crypto.randomBytes(8).toString('hex')}`;
        if (!texts.has(text)) {
            localizedStrings.push({ stringId, [defaultLocaleColumnName]: text });
            texts.add(text);
        }
    }
    for (const step of scenario.steps) {
        if (step.type === "statement" || step.type === "prompt" || step.type === "yesnoprompt") {
            try {
                if (step.text) {
                    addText(step.text);
                }
                if (Array.isArray(step.attachment)) {
                    for (const card of step.attachment) {
                        if (card.type === "HeroCard" || card.type === "ThumbnailCard") {
                            if (card.title) {
                                if (!card.titleStringId) {
                                    addText(card.title);
                                }
                            }
                            if (card.subtitle) {
                                addText(card.subtitle);
                            }
                            if (Array.isArray(card.actions)) {
                                for (const action of card.actions) {
                                    if (action.caption) {
                                        addText(action.caption);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                logger.error(null, `Error occurred while trying to process step ${step} for tenant ${accountName}: ${err}`);
                throw err;
            }
        }
    }
    return localizedStrings;
}

export async function getLocalizedStringsFromScenarios(accountName, accountId) {
    logger.debug(null, `Reviewing all scenarios and gathering String IDs for tenant ${accountName}`);
    // const localizedStrings = await getCustomLocalizedStrings(accountName, accountId);

    const scenariosInfo = await tenantContents[accountName].scenarios.listScenarios();

    // Getting all scenarios from storage in parallel
    const scenarios = new Map<string, any>();
    await Promise.all(scenariosInfo.map(async (scenario) => {
        const parsedScenario = scenario.code;
        scenarios.set(scenario.RowKey, {parsedScenario, scenarioInfo: scenario});
    }));

    // Iterating over scenarios serially to avoid overriding of localized strings
    const localizedStrings = [];
    for (const scenarioInfo of scenariosInfo) {
        const data = scenarios.get(scenarioInfo.RowKey);
        if (data && data.parsedScenario) {
            getScenariosStrings(data.parsedScenario, data.scenarioInfo, accountName, localizedStrings);
        }
    }
    return localizedStrings;
}
