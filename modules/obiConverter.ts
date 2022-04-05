import {Logger} from 'healthbotcommon/logger';
import { LocalizationObject } from 'healthbotcommon/tenantcontent';
const logger = Logger.getInstance();
import { VariableScope } from "../models/admin-portal-v3/scenarios/scenarios.manage.model";

const _ = require('underscore');

export enum StepType {
    ChoiceInput = "Microsoft.ChoiceInput",
    TextInput = "Microsoft.TextInput",
    IfCondition = "Microsoft.IfCondition",
    SendActivity = "Microsoft.SendActivity",
    ConfirmInput = "Microsoft.ConfirmInput",
    BeginDialog = "Microsoft.BeginDialog",
    ReplaceWithDialog = "Microsoft.ReplaceWithDialog",
    EndDialog = "Microsoft.EndDialog",
    SwitchCondition = "Microsoft.SwitchCondition",
    HttpRequest = "Microsoft.HttpRequest",
    SetProperty = "Microsoft.SetProperty"
}

/**
 * 
 * @param code 
 */
export function convert(scenarioId: string, code: any, languageUnderstanding: any, systemLocalizedStrings: LocalizationObject) {

    // Build dictionary of all the steps
    const map = code.steps.reduce((m, s) => {
        m[s.id] = s;
        return m;
    }, {});

    const intent = _.findKey(languageUnderstanding.intent_handler_map, (h) => h.handler === '/scenarios/' + scenarioId);

    const logData = {
        logContext: {
            scenarioId,
            code
        }
    };

    const obiSteps = [];    
    
    function traverse(cs, innerObiSteps) {
        if (cs) {
            let obiStep;
            let branched = false;
            switch (cs.type) {
                case "prompt":               
                    if (cs.designer.listStyle) {
                        let choices;
                        try {
                            choices = JSON.parse(convertExpression(cs.dataType));
                        }
                        catch (err) {
                            logger.error(logData, "Failed to parse prompt data types");
                        }
                        obiStep = [{ $type: StepType.ChoiceInput, prompt: cs.text, style: convertListStyle(cs.designer.listStyle), 
                                     choices, property: "dialog." + cs.variable }];
                    }
                    else {
                        obiStep = [{ $type: StepType.TextInput, prompt: cs.text, property: "dialog." + cs.variable }];
                    }
                    // Check if visible is defined and create if Property accordingly
                    if (cs.visible && cs.visible.trim().length > 0) {
                        obiStep = [{ $type: StepType.IfCondition, condition: convertReference(cs.visible), steps: obiStep[0] }];
                    }
                    break;
                
                case "statement":
                    obiStep =  [{ $type: StepType.SendActivity, activity: convertLG(cs.text) }];
                    break;
                case "branch": 
                    branched = true;
                    obiStep = [{ $type: StepType.IfCondition, condition: convertReference(cs.condition), steps: traverse(map[cs.targetStepId], []), 
                                 elseSteps: traverse(map[cs.designer.next], []) }];
                    break;
                case "yesnoprompt":
                    branched = true;
                    const obiExpr = `dialog.${cs.variable} == true`;
                    obiStep = [ { $type: StepType.ConfirmInput, prompt: cs.text, property: "dialog." + cs.variable, alwaysPrompt: true},
                        { $type: StepType.IfCondition, condition: obiExpr, steps: traverse(map[cs.targetStepId], []), elseSteps: traverse(map[cs.designer.next], []) }];
                    break;
                case "beginScenario": 
                    let beginScenarioArgs;
                    try {
                        beginScenarioArgs = JSON.parse(cs.args);
                    }
                    catch (err) {
                        logger.error(logData, "Failed to parse scenario arguments");
                        
                    }
                    obiStep = [{$type: StepType.BeginDialog, dialog: cs.scenario, options: beginScenarioArgs, property: "dialog." + cs.variable}];
                    break;
                case "replaceScenario": 
                    let replaceScenarioArgs;
                    try {
                        replaceScenarioArgs = JSON.parse(cs.args);
                    }
                    catch (err) {
                        logger.error(logData, "Failed to parse scenario arguments");
                    }
                    obiStep = [ {$type: StepType.ReplaceWithDialog, dialog: cs.scenario, options: replaceScenarioArgs}];
                    break;
                case "endwithresult":
                    obiStep = [{$type: StepType.EndDialog, property: convertReference(cs.returnValue)}];
                    break;
                case "switch": 
                    branched = true;
                    const cases = {};
                    for (let i = 0; i < cs.cases.length; i++) {
                        const hbsCase = cs.cases[i];
                        const targetStep = map[hbsCase.targetStepId];
                        cases[`'${hbsCase.value}'`] = traverse(targetStep, []);
                    }
                    const nextStep = map[cs.designer.next];
                    obiStep = [{$type: StepType.SwitchCondition, condition: convertReference(cs.condition), cases, defult: traverse(nextStep, []) }];
                    break;
                case "datasource":
                    let header;
                    try {
                        header = JSON.parse(convertExpression(cs.headers));
                    }
                    catch (err) {
                        logger.error(logData, "could not parase datasource headers");
                    }
                    obiStep = [{$type: StepType.HttpRequest, url: convertLG(cs.urlBase + cs.urlPath + cs.urlParams), 
                                method: cs.method, property: "dialog." + cs.response, header}];
                    break;
                case "assignVariable": 
                    obiStep = [{$type: StepType.SetProperty, property: convertAssignProperrty(cs.variable, cs.scope), value: convertReference(cs.value)}];
                    break;
            }

            if (obiStep) {
                innerObiSteps.push(...obiStep);
            }

            if (branched) {
                return innerObiSteps;
            }
            const next = map[cs.designer.next];
            if (next) {            
                traverse(next, innerObiSteps);
            }
        }
        return innerObiSteps;
    }

    traverse(code.steps[0], obiSteps);

    const regExpRecognizer = languageUnderstanding.custom_regexp_recognizers[intent] || languageUnderstanding.builtin_regexp_recognizers[intent];

    let recognizer;
    if (regExpRecognizer) {
        recognizer = {
            $type: "Microsoft.RegexRecognizer",
            intents: {}
        };
        const expr =  systemLocalizedStrings["en-us"][regExpRecognizer.expression];
        const match = expr.match(/^\/(.*?)\/([gimy]*)$/);
        let canonicalRegExp;
        if (match) {
            canonicalRegExp = match[2] ? `(?${match[2]})${match[1]}` : match[1];
        }
        recognizer.intents[intent] = canonicalRegExp;
    }

    return {
        $schema: "../../app.schema",
        $type: "Microsoft.AdaptiveDialog",
        recognizer,
        rules: [
            {
                $type: intent ? "Microsoft.IntentRule" : "Microsoft.UnknownIntentRule",
                intent: intent ? intent : undefined, 
                steps: obiSteps
            }]
    };
}

/**
 * Examples: 
 * ${var} ==> {dialog.var}
 * &{var} ==> {user.var}
 *
 * @{var} ==> {conversation.var}
 * @param expression 
 */
function convertExpression(expression: string): string {
    let s =  expression.replace(/\${(\S*)}/, "{dialog.$1}");   
    s = s.replace(/\@{(\S*)}/, "{conversation.$1}");
    s = s.replace(/\bscenario\.(\S+)/, "{dialog.$1}");   
    s = s.replace(/\&{(\S*)}/, "{user.$1}");
    s = s.replace(/\.entity/, ".Value");
    return s;
}

/**
 * Example: "This is " + ${var}" ==> "This is {dialog.var}"
 *
 * @param lg 
 */
function convertLG(lg: string): string {
    // Remove + and spaces around it
    let s = lg.replace(/\s*\+\s*/g, '');
    // Remove ' or " 
    s = s.replace(/[\"\']/g, '');
    s = s.replace(/\${(\S*)}/, "{dialog.$1}");
    s = s.replace(/\bscenario\.(\S+)/, "{dialog.$1}");   
    s = s.replace(/\@{(\S*)}/, "{conversation.$1}");
    s = s.replace(/\&{(\S*)}/, "{user.$1}");
    // ${choice.entity} ==> dialog.choice.Value
    s = s.replace(/\.entity/, ".Value");
    return s;
}

/**
 * Example: "${var}" ==> "dialog.var"
 *
 * @param expression 
 */
function convertReference(expression: string): string {
    let s = expression.replace(/\${(\S*)}/, "dialog.$1");   
    s = s.replace(/\@{(\S*)}/, "conversation.$1");   
    s = s.replace(/\bscenario\.(\S+)/, "dialog.$1");   
    s = s.replace(/\@{(\S*)}/, "conversation.$1");   
    s = s.replace(/\&{(\S*)}/, "user.$1");   
    s = s.replace(/\.entity/, ".Value");    
    return s;
}

/**
 * My style to obi style of choice
 *
 * @param style 
 */
function convertListStyle(style: number): string {
    switch (style) {
        case 0: 
            return "None";
        case 1:
            return "Inline";
        case 2:
            return "List";
        case 3:
            return "HeroCard";
        case 4:
            return "Auto";
    }
    return "SuggestedAction";
}

/**
 * 
 * @param variable 
 * @param scope 
 */
function convertAssignProperrty(variable: string, scope: VariableScope) {
    switch (scope) {
        case VariableScope.scenario:
            return "dialog." + variable;
        case VariableScope.user:
            return "user." + variable;
        case VariableScope.conversation:
            return "conversation." + variable;
    }
}
