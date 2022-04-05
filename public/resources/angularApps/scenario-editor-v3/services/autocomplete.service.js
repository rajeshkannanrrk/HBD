angular.module('scenarioEditorApp.services')
    .service('$autocomplete', function(){
        this.variables = function(windows, existingLocalizationStrings) {
            var variables = [];
            $.each(windows, function(index, value){
                var step = $(value).data('element');
                if (step.hasOwnProperty('variable') && step.variable.length > 0) {
                    if (step.type === "assignVariable") {
                        switch(step.scope) {
                            case "scenario": variables.push('scenario.'+ step.variable); break;
                            case "user": variables.push('user.'+ step.variable); break;
                            case "conversation": variables.push('conversation.' + step.variable + '}'); break;
                            case "global": variables.push('global.' + step.variable); break;    
                        }
                    }
                    else {
                        variables.push('scenario.' + step.variable);
                        variables.push('${' + step.variable +'}');
                    }
                }
                if (step.hasOwnProperty('response') && step.response.length > 0) {
                    variables.push('scenario.' + step.response);
                    variables.push('${' + step.response +'}');
                }
                if (step.hasOwnProperty('error') && step.error.length > 0) {
                    variables.push('scenario.' + step.error);
                    variables.push('${' + step.error +'}');
                }
                if (step.hasOwnProperty('onInit') && step.onInit.length > 0) {
                    var regex = /([$@&]{\S+}).*=.*\S/gm;
                    while ((m = regex.exec(step.onInit)) !== null) {
                        // This is necessary to avoid infinite loops with zero-width matches
                        if (m.index === regex.lastIndex) {
                            regex.lastIndex++;
                        }                        
                        // The result can be accessed through the `m`-variable.
                        m.forEach((match, groupIndex) => {
                            if (groupIndex === 1) {
                                variables.push(match)
                            }
                        });
                    }

                    // New format
                    var regex = /((scenario|user|conversation)\.\S+)\s*=\s*\S+/gm;
                    while ((m = regex.exec(step.onInit)) !== null) {
                        // This is necessary to avoid infinite loops with zero-width matches
                        if (m.index === regex.lastIndex) {
                            regex.lastIndex++;
                        }                        
                        // The result can be accessed through the `m`-variable.
                        m.forEach((match, groupIndex) => {
                            if (groupIndex === 1) {
                                variables.push(match)
                            }
                        });
                    }

                }
            });
            variables.push('conversation.resourcesUrl');
            variables.push('conversation.baseUrl');
            variables.push('conversation.intResourcesUrl');
            variables.push('conversation.initConversationEvent');
            variables.push('scenario.scenarioArgs');
            variables.push('@{resourcesUrl}');
            variables.push('@{baseUrl}');
            variables.push('@{intResourcesUrl}');
            variables.push('@{initConversationEvent}');
            variables.push('${scenarioArgs}');
            variables.push("session.message");
            variables.push({
                type: "function",
                label: "getEnv(envVarName: string)",
                value: "getEnv",
            });
            variables.push({
                type: "function",
                label: "session.trace(data: any, level: number)",
                value: "session.trace",
            });
            variables.push({
                type: "function",
                label: "session.logOutcomeEvent(outcomeLabel: string)",
                value: "session.logOutcomeEvent",
            });
            variables.push({
                type: "function",
                label: "session.logCustomEvent(eventName: string, eventPayload: any)",
                value: "session.logCustomEvent",
            });
            variables.push({
                type: "function",
                label: "session.sendChannelData(text: string, data: any)",
                value: "session.sendChannelData",
            });
            variables.push({
                type: "function",
                label: "session.saveFeedback(feedback: string, score: number)",
                value: "session.saveFeedback"
            });
            variables.push({
                type: "function",
                label: "session.getCustomLocalizedValue(stringId: string, fallbackToDefaultLocale: boolean)",
                value: "session.getCustomLocalizedValue",
            });
            variables.push({
                type: "function",
                label: "session.getSystemLocalizedValue(stringId: string)",
                value: "session.getSystemLocalizedValue",
            });
            variables.push({
                type: "object",
                label: "customLocalizedStrings[stringId: string]",
                value: "customLocalizedStrings",
            });
            variables.push({
                type: "object",
                label: "systemLocalizedStrings[stringId: string]",
                value: "systemLocalizedStrings",
            });
            variables = variables.concat(existingLocalizationStrings || []);
            return _.unique(variables);
        }
    });
