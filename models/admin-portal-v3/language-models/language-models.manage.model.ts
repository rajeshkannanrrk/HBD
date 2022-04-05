import { LocalizationObject, LocalizedString,  } from "healthbotcommon/tenantcontent";
import { defaultLocalizationClient, mergeLocalizationObjects } from "healthbotcommon/tenantcontent/localization";
import { tenantContents } from "../../../modules/globals";
import { logLanguageModelsChange, logLocalizationChange } from "../../../services/auditTrailsLogger";
import * as mainModel from "../main.model";
import * as localizationModel from "./configuration.localization.model";
import { QnAMakerKnowledgeBase } from "./qnmaker/QnAMakerKnowledgeBase.class";

const config = require('config');
const _ = require("underscore");

enum MethodType {
    LUIS = "luis",
    RegEx = "regex",
    QnA = "qna"
}

const builtinScenarios = [
    "/builtin/help",
    "/builtin/terms",
    "/builtin/greeting",
    "/builtin/log",
    "/builtin/feedback",
    "/builtin/forget_me",
    "/builtin/need_to_know",
    "/builtin/triage",
    "/builtin/handoff/teams/agentlogin",
    "/builtin/infermedica/triage",
    "/builtin/capita/triage",
    "/medication/information",
    "/builtin/condition/information",
    "/builtin/condition/symptoms",
    "/builtin/condition/causes",
    "/builtin/condition/complications",
    "/builtin/condition/resources",
    "/builtin/condition/specialties",
    "/builtin/nih/condition/information",
    "/builtin/nih/condition/symptoms",
    "/builtin/nih/condition/resources"
];

async function updateLocalizedString(localizedString: LocalizedString, defaultLocalizedStrings: LocalizationObject, systemLocalizedStrings: LocalizationObject, accountId, accountName, user) {
    if (!localizedString.stringId?.trim() || defaultLocalizedStrings.stringIds.includes(localizedString.stringId)) {
        localizedString.stringId = localizationModel.getStringId(localizedString["en-us"]);
    }

    const existingLocalizedString = getLocalizedString(localizedString.stringId, systemLocalizedStrings);

    if (existingLocalizedString["en-us"] !== localizedString["en-us"]) {
        await tenantContents[accountName].localization.system.saveChanges([localizedString]);

        logLocalizationChange(accountName, "modified", user, "system");
        mainModel.updateLocalizationSettings(accountName);
        mainModel.reloadTenant(accountName);
    }

    return localizedString.stringId;
}

function getLocalizedString(stringId, localizedStrings: LocalizationObject) {
    const translation = localizedStrings["en-us"]?.[stringId];

    return translation ?
        { stringId, "en-us": translation } :
        { "stringId": "", "en-us": "" };
}

function updateLocalizedStringExpression(objectToUpdate, localizedStrings: LocalizationObject) {
    for (const key of Object.keys(objectToUpdate)) {
        if (key.startsWith("_convict")) {
            delete objectToUpdate[key];
            continue;
        }
        const model = objectToUpdate[key];
        const currentExpression = model.expression;
        model.expression = getLocalizedString(model.expression, localizedStrings);
        if (model.expression.stringId === "" && model.expression["en-us"] === "") {
            model.expression["en-us"] = currentExpression;
        }
    }
}

export async function getLuisModels(accountName: string) {
    const config = await tenantContents[accountName].config.load();

    return config.get("language_understanding.luis_models");
}

export interface ILanguageUnderstanding {
    custom_regexp_recognizers: Record<string, any>;
    builtin_regexp_recognizers: Record<string, any>;
    builtin_recognizers: IBuiltinRecognizers;
    intent_handler_map: Record<string, any>;
    qna_recognizers: Record<string, any>;
}

export interface IQnAModel {
    enabled: boolean;
    description: string;
    intent: string;
    qnaEndpoint: string;
    kbId: string;
    subscription_key: string;
    threshold?: number;
    api_key?: string;
}

export interface IBuiltinRecognizers {
    triage_recognizer: Record<string, any>;
}

function getLanguageUnderstanding(tenantConfig): ILanguageUnderstanding {
    const language: ILanguageUnderstanding = tenantConfig.get("language_understanding");
    return language;
}

export async function read(account: { id: string; name: string; }) {
    const [systemLocalizedStrings, isLocalizationEnabled] = await Promise.all([
        tenantContents[account.name].localization.system.get(),
        tenantContents[account.name].config.load().then((tenantConfig) => tenantConfig.get("localizationSettings.isLocalizationEnabled"))
    ]);

    const localizedStrings = mergeLocalizationObjects(defaultLocalizationClient.get(), systemLocalizedStrings);
    const tenantConfig = await tenantContents[account.name].config.load({ localizedStrings });
    const language: ILanguageUnderstanding = getLanguageUnderstanding(tenantConfig);
    const scenarios = (await tenantContents[account.name].scenarios.listLightScenarios()).map((scenario) => ({
        name: scenario.name,
        scenario_trigger: scenario.scenario_trigger,
        RowKey: scenario.RowKey
    }));

    if (language.custom_regexp_recognizers) {
        updateLocalizedStringExpression(language.custom_regexp_recognizers, localizedStrings);
    }

    Object.keys(language.builtin_regexp_recognizers).forEach((key) => {
        if (key.startsWith("_convict")) {
            return;
        }
        if (language.builtin_regexp_recognizers[key].hide) {
            delete language.builtin_regexp_recognizers[key];
        }
    });

    Object.keys(language).forEach((key) => {
        cleanUpConvictFields(language[key]);
    });

    return {
        language,
        scenarios: _.sortBy(scenarios, 'scenario_trigger'),
        builtinScenarios,
        isLocalizationEnabled
    };
}

function cleanUpConvictFields(objectToClean: Record<string, any>) {
    for (const key of Object.keys(objectToClean)) {
        if (key.toLowerCase().startsWith("_convict")) {
            delete objectToClean[key];
        }
    }
}

export async function createNewModel(accountId: string, accountName: string, user: string, updatedModel: any) {
    const defaultLocalizedStrings = defaultLocalizationClient.get();
    const [systemLocalizedStrings, isLocalizationEnabled, specific] = await Promise.all([
        tenantContents[accountName].localization.system.get(),
        tenantContents[accountName].config.load().then((tenantConfig) => tenantConfig.get("localizationSettings.isLocalizationEnabled")),
        tenantContents[accountName].config.getOverrides()
    ]);

    specific.language_understanding = specific.language_understanding || {};
    const tenantConfig = await tenantContents[accountName].config.load({ localizedStrings: mergeLocalizationObjects(defaultLocalizedStrings, systemLocalizedStrings) });
    const language: ILanguageUnderstanding = getLanguageUnderstanding(tenantConfig);

    let modelToReturn;
    switch (updatedModel.type) {
        case MethodType.RegEx:
            if (updatedModel.expression.stringId === null) {
                updatedModel.expression.stringId = localizationModel.getStringId(updatedModel.expression["en-us"]);
                await tenantContents[accountName].localization.system.saveChanges([updatedModel.expression]);

                logLocalizationChange(accountName, "modified", user, "system");
                mainModel.updateLocalizationSettings(accountName);
                mainModel.reloadTenant(accountName);
            }
            let updatedStringId = updatedModel.expression.stringId;
            if (!isLocalizationEnabled) {
                updatedStringId = await updateLocalizedString(updatedModel.expression, defaultLocalizedStrings, systemLocalizedStrings, accountId, accountName, user);
            }
            specific.language_understanding.custom_regexp_recognizers = specific.language_understanding.custom_regexp_recognizers || {};
            specific.language_understanding.custom_regexp_recognizers[updatedModel.name] = {
                enabled: true,
                description: updatedModel.description,
                scope: updatedModel.scope,
                intent: updatedModel.intent,
                expression: updatedStringId
            };
            modelToReturn = JSON.parse(JSON.stringify(specific.language_understanding.custom_regexp_recognizers[updatedModel.name]));
            modelToReturn.expression = {
                "stringId": updatedStringId,
                "en-us": updatedModel.expression['en-us']
            };

            specific.language_understanding.intent_handler_map = specific.language_understanding.intent_handler_map || {};
            specific.language_understanding.intent_handler_map[updatedModel.intent] = language.intent_handler_map[updatedModel.intent] || {};
            specific.language_understanding.intent_handler_map[updatedModel.intent].handler = !(typeof (updatedModel.target) === 'string') || updatedModel.target.trim() === "" ? null : updatedModel.target;
            break;
        case MethodType.LUIS:
            specific.language_understanding.luis_models = specific.language_understanding.luis_models || {};
            specific.language_understanding.luis_models[updatedModel.name] = {
                application_id: updatedModel.application_id,
                subscription_key: updatedModel.subscription_key,
                staging: updatedModel.staging,
                verbose: updatedModel.verbose,
                region: updatedModel.region,
                bing_spell_check_subscription_key: updatedModel.bing_spell_check_subscription_key,
                enabled: updatedModel.enabled,
                description: updatedModel.description,
                scope: updatedModel.scope,
                intents: updatedModel.intents.map((intent) => intent.intent),
            };
            modelToReturn = specific.language_understanding.luis_models[updatedModel.name];
            specific.language_understanding.intent_handler_map = specific.language_understanding.intent_handler_map || {};
            for (const intent of updatedModel.intents) {
                specific.language_understanding.intent_handler_map[intent.intent] = language.intent_handler_map[intent.intent] || {};
                specific.language_understanding.intent_handler_map[intent.intent].handler = !intent.target || !intent.target.handler || !(typeof (intent.target.handler) === 'string') || intent.target.handler.trim() === "" ? null : intent.target.handler;
            }
            break;
        case MethodType.QnA:
            specific.language_understanding.qna_recognizers = specific.language_understanding.qna_recognizers || {};
            specific.language_understanding.qna_recognizers[updatedModel.name] = {
                enabled: true,
                description: updatedModel.description,
                intent: updatedModel.intent,
                qnaEndpoint: updatedModel.qnaEndpoint,
                kbId: updatedModel.kbId,
                subscription_key: updatedModel.subscription_key,
                threshold: Number(updatedModel.threshold) || config.get("qna.minimum_score")
            };
            modelToReturn = JSON.parse(JSON.stringify(specific.language_understanding.qna_recognizers[updatedModel.name]));
            specific.language_understanding.intent_handler_map = specific.language_understanding.intent_handler_map || {};
            specific.language_understanding.intent_handler_map[updatedModel.intent] = language.intent_handler_map[updatedModel.intent] || {};
            specific.language_understanding.intent_handler_map[updatedModel.intent].handler = !(typeof (updatedModel.target) === 'string') || updatedModel.target.trim() === "" ? null : updatedModel.target;
            break;
    }

    await tenantContents[accountName].config.save(specific);
    mainModel.reloadTenant(accountName);

    logLanguageModelsChange(accountName, "created", user, updatedModel.name);

    return {
        name: updatedModel.name,
        model: modelToReturn,
        intent_handler_map: (await tenantContents[accountName].config.load()).get("language_understanding.intent_handler_map")
    };
}

export async function resetModels(accountName: string, user: string) {
    const specific = await tenantContents[accountName].config.getOverrides();

    specific.language_understanding = specific.language_understanding || {};

    delete specific.language_understanding.intent_handler_map;
    delete specific.language_understanding.builtin_recognizers;
    delete specific.language_understanding.builtin_regexp_recognizers;
    delete specific.language_understanding.luis_models;
    delete specific.language_understanding.qna_recognizers;
    delete specific.language_understanding.custom_regexp_recognizers;

    await tenantContents[accountName].config.save(specific);
    mainModel.reloadTenant(accountName);
    logLanguageModelsChange(accountName, "deleted", user, 'all');
}

export async function updateQnaModel(accountId: string, accountName: string, modelToUpdate: { model: IQnAModel }) {
    const specific = await tenantContents[accountName].config.getOverrides();

    specific.language_understanding = specific.language_understanding || {};

    const qnaModels = specific.language_understanding.qna_recognizers || {};
    let found = false;
    for (const model of [...Object.values(qnaModels)] as IQnAModel[]) {
        if (model.api_key === modelToUpdate.model.api_key && model.kbId === modelToUpdate.model.kbId) {
            found = true;
            const qnaMakerKnowledgeBase = new QnAMakerKnowledgeBase({
                tenant: {
                    id: accountId,
                    name: accountName,
                },
                blobURIs: [config.get('qna.covid_19_cdc_knowledge_base')],
                subscriptionKey: model.api_key,
            });
            try {
                const kbs = await qnaMakerKnowledgeBase.getKnowledgeBases();
                const kb = kbs.find((knowledgeBase) => knowledgeBase.id === model.kbId);
                if (!kb) { throw new Error('Knowledgebase id does not match subscription key'); }
                const kbDetails = await qnaMakerKnowledgeBase.getKBDetails(model.kbId);
                await qnaMakerKnowledgeBase.updateKnowledgeBase(model.kbId, kbDetails.urls);
                await qnaMakerKnowledgeBase.publishKnowledgeBase(model.kbId);
            } catch (error) {
                throw new Error('an error occurred, please check your subscription key and try again in a few minutes');
            }
        }
    }
    if (!found) {
        throw new Error("Keys doesn't match");
    }
}

export async function deleteModel(accountName: string, user: string, modelToDelete: any) {
    const specific = await tenantContents[accountName].config.getOverrides();

    specific.language_understanding = specific.language_understanding || {};

    if (modelToDelete.type === 'custom_regexp_recognizers') {
        const intent = specific.language_understanding.custom_regexp_recognizers[modelToDelete.model.name].intent;

        delete specific.language_understanding.custom_regexp_recognizers[modelToDelete.model.name];
        delete specific.language_understanding.intent_handler_map[intent];
    } else if (modelToDelete.type === 'luis_models') {
        for (const intent of modelToDelete.model.intents) {
            if (intent && intent.trim() !== "") {
                delete specific.language_understanding.intent_handler_map[intent];
            }
        }
        delete specific.language_understanding.luis_models[modelToDelete.model.name];
    } else if (modelToDelete.type === 'qna_recognizers') {
        const intent = specific.language_understanding.qna_recognizers[modelToDelete.model.name].intent;

        delete specific.language_understanding.qna_recognizers[modelToDelete.model.name];
        delete specific.language_understanding.intent_handler_map[intent];
    }

    await tenantContents[accountName].config.save(specific);
    mainModel.reloadTenant(accountName);
    logLanguageModelsChange(accountName, "deleted", user, modelToDelete.model.name);
    return {
        name: modelToDelete.model.name,
        intent_handler_map: (await tenantContents[accountName].config.load()).get("language_understanding.intent_handler_map")
    };
}

export async function saveModel(accountId: string, accountName: string, user: string, updatedModel: any) {
    const defaultLocalizedStrings = defaultLocalizationClient.get();
    const [systemLocalizedStrings, isLocalizationEnabled] = await Promise.all([
        tenantContents[accountName].localization.system.get(),
        tenantContents[accountName].config.load().then((tenantConfig) => tenantConfig.get("localizationSettings.isLocalizationEnabled"))
    ]);

    const specific = await tenantContents[accountName].config.getOverrides();
    specific.language_understanding = specific.language_understanding || {};

    const tenantConfig = await tenantContents[accountName].config.load({ localizedStrings: mergeLocalizationObjects(defaultLocalizedStrings, systemLocalizedStrings) });
    const language: ILanguageUnderstanding = getLanguageUnderstanding(tenantConfig);

    let modelToReturn;
    if (updatedModel.type === 'custom_regexp_recognizers') {
        if (updatedModel.model.expression.stringId === null) {
            updatedModel.model.expression.stringId = localizationModel.getStringId(updatedModel.model.expression["en-us"]);
            await tenantContents[accountName].localization.system.saveChanges([updatedModel.model.expression]);

            logLocalizationChange(accountName, "modified", user, "system");
            mainModel.updateLocalizationSettings(accountName);
            mainModel.reloadTenant(accountName);
        }

        let updatedStringId = updatedModel.model.expression.stringId;
        if (!isLocalizationEnabled) {
            updatedStringId = await updateLocalizedString(updatedModel.model.expression, defaultLocalizedStrings, systemLocalizedStrings, accountId, accountName, user);
        }

        const previousIntent = language.custom_regexp_recognizers[updatedModel.model.name].intent;
        specific.language_understanding.custom_regexp_recognizers = specific.language_understanding.custom_regexp_recognizers || {};
        specific.language_understanding.custom_regexp_recognizers[updatedModel.model.name] = {
            enabled: updatedModel.model.enabled,
            description: updatedModel.model.description,
            scope: updatedModel.model.scope,
            intent: updatedModel.model.intent,
            expression: updatedStringId
        };
        modelToReturn = JSON.parse(JSON.stringify(specific.language_understanding.custom_regexp_recognizers[updatedModel.model.name]));
        modelToReturn.expression = {
            "stringId": updatedStringId,
            "en-us": updatedModel.model.expression['en-us']
        };

        specific.language_understanding.intent_handler_map = specific.language_understanding.intent_handler_map || {};
        delete specific.language_understanding.intent_handler_map[previousIntent];
        specific.language_understanding.intent_handler_map[updatedModel.model.intent] = language.intent_handler_map[updatedModel.model.intent] || {};
        specific.language_understanding.intent_handler_map[updatedModel.model.intent].handler = !(typeof (updatedModel.model.target) === 'string') || updatedModel.model.target.trim() === "" ? null : updatedModel.model.target;
    } else if (updatedModel.type === 'builtin_regexp_recognizers') {
        if (updatedModel.model.expression.stringId === null) {
            updatedModel.model.expression.stringId = localizationModel.getStringId(updatedModel.model.expression["en-us"]);
            await tenantContents[accountName].localization.system.saveChanges([updatedModel.model.expression]);

            logLocalizationChange(accountName, "modified", user, "system");
            mainModel.updateLocalizationSettings(accountName);
            mainModel.reloadTenant(accountName);
        }
        let updatedStringId = updatedModel.model.expression.stringId;
        if (!isLocalizationEnabled) {
            updatedStringId = await updateLocalizedString(updatedModel.model.expression, defaultLocalizedStrings, systemLocalizedStrings, accountId, accountName, user);
        }

        specific.language_understanding.builtin_regexp_recognizers = specific.language_understanding.builtin_regexp_recognizers || {};
        specific.language_understanding.builtin_regexp_recognizers[updatedModel.model.name] = specific.language_understanding.builtin_regexp_recognizers[updatedModel.model.name] || {};

        if (language.builtin_regexp_recognizers[updatedModel.model.name].scope !== updatedModel.model.scope) {
            specific.language_understanding.builtin_regexp_recognizers[updatedModel.model.name].scope = updatedModel.model.scope;
        }
        if (language.builtin_regexp_recognizers[updatedModel.model.name].expression.stringId !== updatedStringId) {
            specific.language_understanding.builtin_regexp_recognizers[updatedModel.model.name].expression = updatedStringId;
        }
        if (_.isEmpty(specific.language_understanding.builtin_regexp_recognizers[updatedModel.model.name])) {
            delete specific.language_understanding.builtin_regexp_recognizers[updatedModel.model.name];
        }
        if (_.isEmpty(specific.language_understanding.builtin_regexp_recognizers)) {
            delete specific.language_understanding.builtin_regexp_recognizers;
        }

        modelToReturn = (await tenantContents[accountName].config.load()).get("language_understanding.builtin_regexp_recognizers")[updatedModel.model.name];

        const previousIntent = language.builtin_regexp_recognizers[updatedModel.model.name].intent;
        if (language.intent_handler_map[previousIntent].handler !== updatedModel.model.target) {
            specific.language_understanding.intent_handler_map = specific.language_understanding.intent_handler_map || {};
            delete specific.language_understanding.intent_handler_map[previousIntent];
            specific.language_understanding.intent_handler_map[updatedModel.model.intent] = language.intent_handler_map[updatedModel.model.intent] || {};
            specific.language_understanding.intent_handler_map[updatedModel.model.intent].handler = !(typeof (updatedModel.model.target) === 'string') || updatedModel.model.target.trim() === "" ? null : updatedModel.model.target;
        }
    } else if (updatedModel.type === 'luis_models') {
        specific.language_understanding.luis_models[updatedModel.model.name].scope = updatedModel.model.scope;
        specific.language_understanding.luis_models[updatedModel.model.name].region = updatedModel.model.region;
        specific.language_understanding.luis_models[updatedModel.model.name].bing_spell_check_subscription_key = updatedModel.model.bing_spell_check_subscription_key;
        specific.language_understanding.luis_models[updatedModel.model.name].subscription_key = updatedModel.model.subscription_key;
        specific.language_understanding.luis_models[updatedModel.model.name].staging = updatedModel.model.staging;
        specific.language_understanding.luis_models[updatedModel.model.name].verbose = updatedModel.model.verbose;

        specific.language_understanding.intent_handler_map = specific.language_understanding.intent_handler_map || {};
        for (const intent of specific.language_understanding.luis_models[updatedModel.model.name].intents) {
            if (intent && intent.trim() !== "") {
                delete specific.language_understanding.intent_handler_map[intent];
            }
        }
        specific.language_understanding.luis_models[updatedModel.model.name].intents = updatedModel.model.intents.map((intent) => intent.intent);
        modelToReturn = specific.language_understanding.luis_models[updatedModel.model.name];
        for (const intent of updatedModel.model.intents) {
            specific.language_understanding.intent_handler_map[intent.intent] = language.intent_handler_map[intent.intent] || {};
            specific.language_understanding.intent_handler_map[intent.intent].handler = !(typeof (intent.target) === 'string') || intent.target.trim() === "" ? null : intent.target;
        }
    } else if (updatedModel.type === 'builtin_recognizers') {
        if (language.builtin_recognizers[updatedModel.model.name].scope !== updatedModel.model.scope) {
            specific.language_understanding.builtin_recognizers = specific.language_understanding.builtin_recognizers || {};
            specific.language_understanding.builtin_recognizers[updatedModel.model.name] = specific.language_understanding.builtin_recognizers[updatedModel.model.name] || {};
            specific.language_understanding.builtin_recognizers[updatedModel.model.name].scope = updatedModel.model.scope;
        }

        modelToReturn = (await tenantContents[accountName].config.load()).get("language_understanding.builtin_recognizers")[updatedModel.model.name];

        for (const intent of updatedModel.model.intents) {
            if (language.intent_handler_map[intent.intent].handler !== intent.target) {
                specific.language_understanding.intent_handler_map = specific.language_understanding.intent_handler_map || {};
                specific.language_understanding.intent_handler_map[intent.intent] = language.intent_handler_map[intent.intent] || {};
                specific.language_understanding.intent_handler_map[intent.intent].handler = !(typeof (intent.target) === 'string') || intent.target.trim() === "" ? null : intent.target;
            }
        }
    } else if (updatedModel.type === 'qna_recognizers') {
        const previousIntent = language.qna_recognizers[updatedModel.model.name].intent;
        specific.language_understanding.qna_recognizers = specific.language_understanding.qna_recognizers || {};
        specific.language_understanding.qna_recognizers[updatedModel.model.name] = {
            enabled: updatedModel.model.enabled,
            description: updatedModel.model.description,
            intent: updatedModel.model.intent,
            qnaEndpoint: updatedModel.model.qnaEndpoint,
            kbId: updatedModel.model.kbId,
            subscription_key: updatedModel.model.subscription_key,
            threshold: updatedModel.model.threshold ? Number(updatedModel.model.threshold) : undefined,
            api_key: updatedModel.model.api_key
        };
        modelToReturn = JSON.parse(JSON.stringify(specific.language_understanding.qna_recognizers[updatedModel.model.name]));
        specific.language_understanding.intent_handler_map = specific.language_understanding.intent_handler_map || {};
        delete specific.language_understanding.intent_handler_map[previousIntent];
        specific.language_understanding.intent_handler_map[updatedModel.model.intent] = language.intent_handler_map[updatedModel.model.intent] || {};
        specific.language_understanding.intent_handler_map[updatedModel.model.intent].handler = !(typeof (updatedModel.model.target) === 'string') || updatedModel.model.target.trim() === "" ? null : updatedModel.model.target;
    }

    await tenantContents[accountName].config.save(specific);
    mainModel.reloadTenant(accountName);

    logLanguageModelsChange(accountName, "modified", user, updatedModel.model.name);

    return {
        name: updatedModel.model.name,
        model: modelToReturn,
        intent_handler_map: (await tenantContents[accountName].config.load()).get("language_understanding.intent_handler_map")
    };
}

export async function toggleEnabled(accountName: string, user: string, modelToChange: any) {
    const enabled = modelToChange.enabled;
    const name = modelToChange.name;
    const modelType = modelToChange.type;

    const specific = await tenantContents[accountName].config.getOverrides();
    const tenantConfig = await tenantContents[accountName].config.load();
    const language: ILanguageUnderstanding = getLanguageUnderstanding(tenantConfig);

    if (language[modelType][name].enabled !== enabled) {
        specific.language_understanding = specific.language_understanding || {};
        specific.language_understanding[modelType] = specific.language_understanding[modelType] || {};
        specific.language_understanding[modelType][name] = specific.language_understanding[modelType][name] || {};
        specific.language_understanding[modelType][name].enabled = enabled;

        await tenantContents[accountName].config.save(specific);
        mainModel.reloadTenant(accountName);
        logLanguageModelsChange(accountName, "modified", user, name);
    }
}
