(function() {
    angular.module('adminPortalApp.controllers')
        .controller('languageModelsCtrl', function ($rootScope, $scope, $http, $timeout, $window, $moment, localStorageService) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;

            vm.builtinScenarios = [""];

            vm.builtinQnaScenarios = [
                "/builtin/qna"
            ];

            /**************************************************************************************************
             * loading data on controller init event
             ***************************************************************************************************/

            vm.init = function() {
                root.modal.showProgress('Loading');
                vm.luisRegions = [
                    { value: "eastasia", name: "East Asia" },
                    { value: "souteastasia", name: "Southeast Asia" },
                    { value: "australiaeast", name: "Australia East" },
                    { value: "northeurope", name: "North Europe" },
                    { value: "westeurope", name: "West Europe" },
                    { value: "eastus", name: "East US" },
                    { value: "eastus2", name: "East US 2" },
                    { value: "southcentralus", name: "South Central US" },
                    { value: "westcentralus", name: "West Central US" },
                    { value: "westus", name: "West US" },
                    { value: "westus2", name: "West US 2" },
                    { value: "brazilsouth", name: "Brazil South" }
                ];
                vm.typeToMethodMap = {
                    'builtin_recognizers': "System",
                    'luis_models': "LUIS",
                    'builtin_regexp_recognizers': "RegExp",
                    'custom_regexp_recognizers': "RegExp",
                    'qna_recognizers': "QnA Maker"
                };
                vm.defaultThresholds = {
                    'qna': 50
                };

                vm.selectSingleRange = function(id, field) {

                };
                vm.newModel = {};
                vm.defaultQNATarget = "/builtin/qna";
                vm.newModelValidation = {};
                vm.loadData().then(function () { root.modal.hideProgress() });
                $('#deleteModelModal, #resetModelsModal').on('shown.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                $('#deleteModelModal, #resetModelsModal').on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
            };

            vm.loadData = function() {
                return $http.get('./manage/read').then(
                    function(response) {
                        vm.builtinScenarios = vm.builtinScenarios.concat(response.data.builtinScenarios);
                        vm.isLocalizationEnabled = response.data.isLocalizationEnabled || false;
                        vm.tenantScenarios = response.data.scenarios || [];
                        
                        vm.scenarioTriggers = vm.builtinScenarios.concat(vm.tenantScenarios.map(function(scenario) {return scenario.scenario_trigger}));
                        vm.scenarioIds = vm.builtinScenarios.concat(vm.tenantScenarios.map(function(scenario) {return '/scenarios/' + scenario.scenario_trigger}));
                        
                        vm.scenarioQnaTriggers = vm.builtinQnaScenarios.concat(vm.tenantScenarios.map(function(scenario) {return scenario.scenario_trigger}));
                        vm.scenarioQnaIds = vm.builtinQnaScenarios.concat(vm.tenantScenarios.map(function(scenario) {return '/scenarios/' + scenario.scenario_trigger}));

                        vm.luis_models = response.data.language.luis_models;
                        vm.luis_models.names = Object.keys(response.data.language.luis_models).filter(function(name) { return !name.startsWith("_convict") });
                        vm.luis_models.list = vm.luis_models.names.map(function(name) { return vm.luis_models[name] });
                        vm.builtin_recognizers = response.data.language.builtin_recognizers;
                        vm.builtin_recognizers.names = Object.keys(response.data.language.builtin_recognizers).filter(function(name) { return !name.startsWith("_convict") });
                        vm.builtin_recognizers.list = vm.builtin_recognizers.names.map(function(name) { return vm.builtin_recognizers[name] });
                        vm.custom_regexp_recognizers = response.data.language.custom_regexp_recognizers;
                        vm.custom_regexp_recognizers.names = Object.keys(response.data.language.custom_regexp_recognizers).filter(function(name) { return !name.startsWith("_convict") });
                        vm.custom_regexp_recognizers.list = vm.custom_regexp_recognizers.names.map(function(name) { return vm.custom_regexp_recognizers[name] });
                        vm.builtin_regexp_recognizers = response.data.language.builtin_regexp_recognizers;
                        vm.builtin_regexp_recognizers.names = Object.keys(response.data.language.builtin_regexp_recognizers).filter(function(name) { return !name.startsWith("_convict") });
                        vm.builtin_regexp_recognizers.list = vm.builtin_regexp_recognizers.names.map(function(name) { return vm.builtin_regexp_recognizers[name] });
                        vm.qna_recognizers = response.data.language.qna_recognizers;
                        vm.qna_recognizers.names = Object.keys(response.data.language.qna_recognizers).filter(function(name) { return !name.startsWith("_convict") });
                        vm.qna_recognizers.list = vm.qna_recognizers.names.map(function(name) { return vm.qna_recognizers[name] });
                        vm.intent_handler_map = response.data.language.intent_handler_map;
                    },
                    function(errorResponse) {
                        if (errorResponse.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading language models list. Please try again");
                    }
                );
            };

            vm.refresh = function() {
                root.modal.showProgress('Loading');
                vm.loadData().then(function () { root.modal.hideProgress() });
            };

            vm.toggleEnabled = function(model, name, type) {
                model.enabled = !model.enabled;
                root.modal.showProgress(model.enabled ? 'Activating model' : 'Deactivating model');
                $http.post('./manage/toggleEnabled', { enabled: model.enabled, name: name, type: type }).then(function (response) {
                    root.modal.hideProgress();
                },
                function (errorResponse) {
                    root.modal.hideProgress();
                    model.enabled = !model.enabled;
                    root.toastr.error("Sorry, an error occurred while activating language model. Please try again later.");
                    console.error(errorResponse);
                })
            };

            function mergeFetchedIntents(model, fetched, intent_handler_map) {
                var intentToObject = {};
                var mergedIntentToObject = {};
                const normalizedIntents = new Set(); // This set include the normalized form of the intent names (i.e. dots and spaces are transformed to underscores).
                vm.addNormalizedIntentsToSet(normalizedIntents); // Fill the set with the normalized values.
                model.intents.forEach(function(item) {
                    intentToObject[item.intent] = item;
                    normalizedIntents.delete(item.intent.replace(/\.| /g, '_')); // Remove the normalized form of model intents from the set, so we won't detect existing intents as collisions.
                });
                fetched.intents.forEach(function(item) {
                    if (item.intent !== "None") {
                        let warningMessage;
                        if (item.intent.includes(" ") || item.intent.includes(".")) {
                            warningMessage = "Intent must not include spaces or dots. Consider using underscores instead."
                        }
                        else if (intent_handler_map[item.intent]  && intent_handler_map[item.intent].handler !== undefined  && (!model.hasOwnProperty("originalIntent") || model.originalIntents.includes(item.intent))) {
                            warningMessage = "This intent is in use by another model. Modify one of the models so intents are unique.";
                        }
                        else if (normalizedIntents.has(item.intent)) {
                            warningMessage = "This intent is in use by another model (spaces, dots and underscores are equivalent when comparing intents). Modify one of the models so intents are unique.";
                        }
                        else {
                            warningMessage = null;
                        }
                        mergedIntentToObject[item.intent] = intentToObject[item.intent] || {
                            intent: item.intent,
                            target: intent_handler_map[item.intent],
                            warning: warningMessage
                        }
                    }
                });

                while (model.intents.length > 0) {
                    model.intents.pop();
                }

                Object.keys(mergedIntentToObject).forEach(function(intent){
                    model.intents.push(mergedIntentToObject[intent]);
                });
            }

            vm.fetchNewLuisModelIntents = function() {
                if (vm.validateNewLuisModel()) {
                    $http.get('https://' + vm.newModel.region + '.api.cognitive.microsoft.com/luis/v2.0/apps/' + vm.newModel.application_id + '?subscription-key=' + vm.newModel.subscription_key + '&verbose=true&q=test').then(function (response) {
                        mergeFetchedIntents(vm.newModel, response.data, vm.intent_handler_map)
                    },
                    function (err) {
                        root.toastr.error("Fetching intents failed. Please check application id and subscription key and try again.");
                    })
                }
            };

            vm.testNewQnAConnection = function() {
                if (vm.validateNewQnAModel(false)) {
                    vm.testQnAConnection(vm.newModel.qnaEndpoint, vm.newModel.kbId, vm.newModel.subscription_key);
                }                    
            }

            vm.testExistingQnAConnection = function() {
                if (vm.validateExistingQnAModel(false)) {
                    vm.testQnAConnection(vm.modelToEdit.model.qnaEndpoint, vm.modelToEdit.model.kbId, vm.modelToEdit.model.subscription_key);
                }                
            }

            vm.testQnAConnection = function(endpoint, kbId, key) {
                var req = {
                    method: 'POST',
                    url: endpoint + "/knowledgebases/" + kbId + "/generateAnswer",
                    headers: {
                        'Authorization': 'EndpointKey ' + key
                    },
                    data: { question: 'hi' }
                }
                root.modal.showProgress('Testing');
                $http(req).then(function(d) {
                    root.modal.hideProgress();
                    try {
                        if (d.data && d.data.hasOwnProperty('answers') && d.data.answers.length >= 0) {
                            root.toastr.success("QnA Maker validated");
                        }
                        else {
                            root.toastr.error("QnA maker request failed. Please check your endpoint details and try again");
                        }
                    }
                    catch (e) {
                        root.toastr.error("QnA maker request failed. Please check your endpoint details and try again");                        
                    }
                }, 
                function(err) {
                    root.modal.hideProgress();
                    root.toastr.error("QnA maker request failed. Please check your endpoint details and try again");                        
                });
            }

            vm.fetchExistingLuisModelIntents = function() {
                if (vm.validateExistingLuisModel()) {
                    $http.get('https://' + vm.modelToEdit.model.region + '.api.cognitive.microsoft.com/luis/v2.0/apps/' + vm.modelToEdit.model.application_id + '?subscription-key=' + vm.modelToEdit.model.subscription_key + '&verbose=true&q=test').then(function (response) {
                            mergeFetchedIntents(vm.modelToEdit.model, response.data, vm.intent_handler_map)
                        },
                        function (err) {
                            root.toastr.error("Fetching intents failed. Please check application id and subscription key and try again.");
                        })
                }
            };

            vm.openNewModelForm = function () {
                vm.newModelValidation = {};
                vm.newModel = {
                    type: "luis",
                    scope: "Top Level Dialog",
                    enabled: true,
                    expression: {
                        "en-us": "",
                        "stringId": ""
                    },
                    target: vm.scenarioTriggers && vm.scenarioTriggers[0],
                    region: "westus",
                    staging: false,
                    verbose: true,
                    intent: "",
                    intents: []
                };
                vm.localizedString = {
                    _tenant: {
                        "stringId": "",
                        "en-us": ""
                    }
                };
                root.openDrawer("newModelDrawer");
            };

            vm.methodChanged = function(modeState) {
                switch (modeState) {
                    case "newModel":
                        vm.newModel.threshold = vm.newModel.threshold || vm.defaultThresholds[vm.newModel.type];
                        console.log(vm.newModel);
                        break;
                    default:
                        reutrn;
                }

            };

            vm.closeNewModelForm = function () {
                root.closeDrawer("newModelDrawer");
            };

            vm.validateNewModel = function() {
                var errFieldId = null;

                if (!vm.newModel.name || vm.newModel.name.trim().length === 0) {
                    vm.newModelValidation.name = "Name is required";
                    errFieldId = errFieldId || '#modelName';
                }
                else if (vm.newModel.name && (vm.custom_regexp_recognizers.names.includes(vm.newModel.name) || 
                                              vm.luis_models.names.includes(vm.newModel.name) || 
                                              vm.qna_recognizers.names.includes(vm.newModel.name))) {
                    vm.newModelValidation.name = "Name already exists";
                    errFieldId = errFieldId || '#modelName';
                }

                if (!vm.newModel.description || vm.newModel.description.trim() === "") {
                    vm.newModelValidation.description = "Description is required";
                    errFieldId = errFieldId || '#modelDescription';
                }

                return errFieldId;
            };

            vm.validateNewRegexModel = function() {
                vm.newModelValidation = {};
                var errFieldId = vm.validateNewModel();

                if (!vm.newModel.expression || !vm.newModel.expression['en-us'] || vm.newModel.expression['en-us'].trim() === "") {
                    vm.newModelValidation.expression = "Regular Expression is required";
                    errFieldId = errFieldId || '#regularExpression';
                } else if (vm.newModel.expression && vm.custom_regexp_recognizers.list.concat(vm.builtin_regexp_recognizers.list).filter(function(regexpRecognizer) { return regexpRecognizer.expression['en-us'] === vm.newModel.expression['en-us'] }).length > 0) {
                    vm.newModelValidation.expression = "Regular Expression already in use";
                    errFieldId = errFieldId || '#regularExpression';
                }

                var regexpMatch = vm.newModel.expression['en-us'].match(/^\/(.*?)\/([gimy]*)$/);
                if (!regexpMatch) {
                    vm.newModelValidation.expression = "Invalid Regular Expression";
                    errFieldId = errFieldId || '#regularExpression';
                }

                if (!vm.newModel.intent || vm.newModel.intent.trim() === "") {
                    vm.newModelValidation.intent = "Intent is required";
                    errFieldId = errFieldId || '#regexIntent';
                }
                else if (vm.newModel.intent.includes(" ") || vm.newModel.intent.includes(".")) {
                    vm.newModelValidation.intent = "Intent must not include spaces or dots. Consider using underscores instead.";
                    errFieldId = errFieldId || '#regexIntent';
                }
                else if (vm.intent_handler_map[vm.newModel.intent] && vm.intent_handler_map[vm.newModel.intent].handler !== undefined) {
                    vm.newModelValidation.intent = "This intent is in use by another model. Modify one of the models so intents are unique.";
                    errFieldId = errFieldId || '#regexIntent';
                }
                else {
                    const normalizedIntents = new Set(); // This set include the normalized form of the intent names (i.e. dots and spaces are transformed to underscores).
                    vm.addNormalizedIntentsToSet(normalizedIntents); // Fill the set with the normalized values.
                    if (normalizedIntents.has(vm.newModel.intent)) { // At this point we already know vm.newModel.intent is normalized, no need to normalize it.
                        vm.newModelValidation.intent = "This intent is in use by another model (spaces, dots and underscores are equivalent when comparing intents). Modify one of the models so intents are unique.";
                        errFieldId = errFieldId || '#regexIntent';
                    }
                }

                if (errFieldId) {
                    $(errFieldId).trigger("focus");
                    return false;
                }
                return true;
            };

            vm.validateNewLuisModel = function() {
                vm.newModelValidation = {};
                var errFieldId = vm.validateNewModel();

                var guidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
                if (!vm.newModel.application_id || !vm.newModel.application_id.trim() === "") {
                    vm.newModelValidation.application_id = "Application ID is required";
                    errFieldId = errFieldId || '#luisAppId';
                } else if (!guidRegex.test(vm.newModel.application_id)) {
                    vm.newModelValidation.application_id = "Invalid Application ID";
                    errFieldId = errFieldId || '#luisAppId';
                }

                if (!vm.newModel.subscription_key || !vm.newModel.subscription_key.trim() === "") {
                    vm.newModelValidation.subscription_key = "Subscription key is required";
                    errFieldId = errFieldId || '#luisSubscriptionKey';
                }

                if (errFieldId) {
                    $(errFieldId).trigger("focus");
                    return false;
                }
                return true;
            };

            vm.validateNewQnAModel = function(withIntent) {
                vm.newModelValidation = {};
                var errFieldId = vm.validateNewModel();
                if (!vm.newModel.target) {
                    vm.newModel.target = vm.defaultQNATarget;
                }
                var guidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
                if (!vm.newModel.qnaEndpoint || !vm.newModel.qnaEndpoint.trim() === "") {
                    vm.newModelValidation.qnaEndpoint = "QnA Endpoint is required";
                    errFieldId = errFieldId || '#QnAHost';
                }
                if (!vm.newModel.subscription_key || !vm.newModel.subscription_key.trim() === "") {
                    errFieldId = errFieldId || '#QnAKey';
                    vm.newModelValidation.subscription_key = "QnA Endpoint key is required";
                } else if (!guidRegex.test(vm.newModel.subscription_key)) {
                    vm.newModelValidation.subscription_key = "QnA Endpoint key";
                    errFieldId = errFieldId || '#QnAKey';
                    vm.newModelValidation.subscription_key = "Invalid QnA Endpoint key";
                }
                if (withIntent && (!vm.newModel.intent || vm.newModel.intent.trim() === "")) {
                    vm.newModelValidation.intent = "Intent is required";
                    errFieldId = errFieldId || '#QnAIntent';
                }
                else if (vm.newModel.intent.includes(" ") || vm.newModel.intent.includes(".")) {
                    vm.newModelValidation.intent = "Intent must not include spaces or dots. Consider using underscores instead.";
                    errFieldId = errFieldId || '#QnAIntent';
                }
                else if (vm.intent_handler_map[vm.newModel.intent] && vm.intent_handler_map[vm.newModel.intent].handler !== undefined) {
                    vm.newModelValidation.intent = "This intent is in use by another model. Modify one of the models so intents are unique.";
                    errFieldId = errFieldId || '#QnAIntent';
                }
                else {
                    const normalizedIntents = new Set(); // This set include the normalized form of the intent names (i.e. dots and spaces are transformed to underscores).
                    vm.addNormalizedIntentsToSet(normalizedIntents); // Fill the set with the normalized values.
                    if (normalizedIntents.has(vm.newModel.intent)) {  // At this point we already know vm.newModel.intent is normalized, no need to normalize it.
                        vm.newModelValidation.intent = "This intent is in use by another model (spaces, dots and underscores are equivalent when comparing intents). Modify one of the models so intents are unique.";
                        errFieldId = errFieldId || '#QnAIntent';
                    }
                }
                if (!vm.newModel.kbId || vm.newModel.kbId.trim() === "") {
                    vm.newModelValidation.kbId = "KnowledgeBase Id is required";
                    errFieldId = errFieldId || '#knowledgeBaseID';
                }
                else if (guidRegex.test(vm.newModel.kbId) === false) {
                    vm.newModelValidation.kbId = "Invalid KnowledgeBase id";
                    errFieldId = errFieldId || '#knowledgeBaseID';
                }

                if (errFieldId) {
                    $(errFieldId).trigger("focus");
                    return false;
                }
                return true;
            }

            vm.validateNewIntents = function() {
                vm.existingModelValidation = {};
                var isValid = true;

                // TODO @Accessibility - are those intents focusable?
                vm.newModel.intents && vm.newModel.intents.forEach(function (intent) { isValid = isValid && intent.warning == null });

                return isValid;
            };

            vm.addNewModel = function() {
                if (vm.newModel.type === "regex" && !vm.validateNewRegexModel()) {
                    return;
                }
                if (vm.newModel.type === "luis" && (!vm.validateNewLuisModel() || !vm.validateNewIntents())) {
                    return;
                }
                if (vm.newModel.type === "qna" && (!vm.validateNewQnAModel(true) || !vm.validateNewIntents())) {
                    return;
                }

                vm.closeNewModelForm();
                root.modal.showProgress('Adding model');
                $http.post('./manage/model', vm.newModel).then(function (response) {

                    switch(vm.newModel.type) {
                        case 'regex':
                            vm.custom_regexp_recognizers[response.data.name] = response.data.model;
                            delete vm.custom_regexp_recognizers.names;
                            delete vm.custom_regexp_recognizers.list;
                            vm.custom_regexp_recognizers.names = Object.keys(vm.custom_regexp_recognizers).filter(function(name) { return !name.startsWith("_convict") });
                            vm.custom_regexp_recognizers.list = vm.custom_regexp_recognizers.names.map(function(name) { return vm.custom_regexp_recognizers[name] });
                            vm.intent_handler_map[response.data.model.intent] = vm.intent_handler_map[response.data.model.intent] || {};
                            vm.intent_handler_map[response.data.model.intent].handler = vm.newModel.target;
                            break;
                        case 'luis':
                            vm.luis_models[response.data.name] = response.data.model;
                            delete vm.luis_models.names;
                            delete vm.luis_models.list;
                            vm.luis_models.names = Object.keys(vm.luis_models).filter(function(name) { return !name.startsWith("_convict") });
                            vm.luis_models.list = vm.luis_models.names.map(function(name) { return vm.luis_models[name] });
                            vm.intent_handler_map = response.data.intent_handler_map;
                            break;
                        case 'qna': 
                            vm.qna_recognizers[response.data.name] = response.data.model;
                            delete vm.qna_recognizers.names;
                            delete vm.qna_recognizers.list;
                            vm.qna_recognizers.names = Object.keys(vm.qna_recognizers).filter(function(name) { return !name.startsWith("_convict") });
                            vm.qna_recognizers.list = vm.qna_recognizers.names.map(function(name) { return vm.qna_recognizers[name] });
                            vm.intent_handler_map[response.data.model.intent] = vm.intent_handler_map[response.data.model.intent] || {};
                            vm.intent_handler_map[response.data.model.intent].handler = vm.newModel.target;
                            break;
                    }
                    root.modal.hideProgress();
                    root.toastr.success("Successfully added language model");
                    },
                function (errorResponse) {
                    root.modal.hideProgress();
                    root.toastr.error("Sorry, an error occurred while adding language model. Please try again later.");
                    console.error(errorResponse);
                })
            };

            vm.openEditModelForm = function (model, name, type) {
                vm.existingModelValidation = {};
                vm.modelToEdit = {
                    model: JSON.parse(JSON.stringify(model)),
                    type: type
                };
                vm.modelToEdit.model.name = name;
                if (vm.modelToEdit.type === "custom_regexp_recognizers" || vm.modelToEdit.type === "builtin_regexp_recognizers") {
                    vm.modelToEdit.model.originalIntent = vm.modelToEdit.model.intent;
                    vm.modelToEdit.model.target = vm.intent_handler_map[vm.modelToEdit.model.intent] ? vm.intent_handler_map[vm.modelToEdit.model.intent].handler : "";
                } else if (vm.modelToEdit.type === "luis_models" || vm.modelToEdit.type === "builtin_recognizers") {
                    vm.modelToEdit.model.originalIntents = vm.modelToEdit.model.intents;
                    vm.modelToEdit.model.intents = vm.modelToEdit.model.intents.map(function (intent) {
                        return {
                            intent: intent,
                            target: vm.intent_handler_map[intent] ? vm.intent_handler_map[intent].handler : ""
                        };
                    });
                } else if (vm.modelToEdit.type === 'qna_recognizers') {
                    vm.modelToEdit.model.originalIntent = vm.modelToEdit.model.intent;
                    vm.modelToEdit.model.target = vm.intent_handler_map[vm.modelToEdit.model.intent] ? vm.intent_handler_map[vm.modelToEdit.model.intent].handler : "";
                    vm.modelToEdit.model.threshold = vm.modelToEdit.model.threshold || vm.defaultThresholds.qna;
                }

                vm.localizedString = {
                    _tenant: vm.modelToEdit.model.expression
                };
                root.openDrawer("editModelDrawer");
            };

            vm.closeEditModelForm = function () {
                root.closeDrawer("editModelDrawer");
            };

            vm.validateExistingRegexModel = function() {
                vm.existingModelValidation = {};
                var errFieldId = null;

                if (!vm.modelToEdit.model.expression || !vm.modelToEdit.model.expression['en-us'] || vm.modelToEdit.model.expression['en-us'].trim() === "") {
                    vm.existingModelValidation.expression = "Regular Expression is required";
                    errFieldId = errFieldId || '#editModelRegex';
                } else if (vm.modelToEdit.model.expression && vm.custom_regexp_recognizers.list.concat(vm.builtin_regexp_recognizers.list).filter(function(regexpRecognizer) { return regexpRecognizer.expression['en-us'] === vm.modelToEdit.model.expression['en-us'] }).length > 1) {
                    vm.existingModelValidation.expression = "Regular Expression already in use";
                    errFieldId = errFieldId || '#editModelRegex';
                }

                var regexpMatch = vm.modelToEdit.model.expression['en-us'].match(/^\/(.*?)\/([gimy]*)$/);
                if (!regexpMatch) {
                    vm.existingModelValidation.expression = "Invalid Regular Expression";
                    errFieldId = errFieldId || '#editModelRegex';
                }

                if (!vm.modelToEdit.model.intent || vm.modelToEdit.model.intent.trim() === "") {
                    vm.existingModelValidation.intent = "Intent is required";
                    errFieldId = errFieldId || '#editRegexIntent';
                }
                else if (vm.modelToEdit.model.intent.includes(" ") || vm.modelToEdit.model.intent.includes(".")) {
                    vm.existingModelValidation.intent = "Intent must not include spaces or dots. Consider using underscores instead.";
                    errFieldId = errFieldId || '#editRegexIntent';
                }
                else if (vm.intent_handler_map[vm.modelToEdit.model.intent] && vm.intent_handler_map[vm.modelToEdit.model.intent] !== undefined && vm.modelToEdit.model.intent !== vm.modelToEdit.model.originalIntent) {
                    vm.existingModelValidation.intent = "This intent is in use by another model. Modify one of the models so intents are unique.";
                    errFieldId = errFieldId || '#editRegexIntent';
                }
                else {
                    const normalizedIntents = new Set(); // This set include the normalized form of the intent names (i.e. dots and spaces are transformed to underscores).
                    vm.addNormalizedIntentsToSet(normalizedIntents); // Fill the set with the normalized values.
                    if (normalizedIntents.has(vm.modelToEdit.model.intent) && vm.modelToEdit.model.intent !== vm.modelToEdit.model.originalIntent.replace(/\.| /g, '_')) { // We don't consider it as a collision when intent is equal to the normalized form of the original intent.
                        vm.existingModelValidation.intent = "This intent is in use by another model (spaces, dots and underscores are equivalent when comparing intents). Modify one of the models so intents are unique.";
                        errFieldId = errFieldId || '#editRegexIntent';
                    }
                }

                if (errFieldId) {
                    $(errFieldId).trigger("focus");
                    return false;
                }

                return true;
            };

            vm.validateExistingLuisModel = function() {
                vm.existingModelValidation = {};
                var errFieldId = null;

                var guidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
                if (!vm.modelToEdit.model.application_id || !vm.modelToEdit.model.application_id.trim() === "") {
                    vm.existingModelValidation.application_id = "Application ID is required";
                    errFieldId = errFieldId || '#editAppId';
                } else if (!guidRegex.test(vm.modelToEdit.model.application_id)) {
                    vm.existingModelValidation.application_id = "Invalid Application ID";
                    errFieldId = errFieldId || '#editAppId';
                }
                if (!vm.modelToEdit.model.subscription_key || !vm.modelToEdit.model.subscription_key.trim() === "") {
                    vm.existingModelValidation.subscription_key = "Subscription key is required";
                    errFieldId = errFieldId || '#editSubscriptionId';
                }

                if (errFieldId) {
                    $(errFieldId).trigger("focus");
                    return false;
                }

                return true;
            };

            vm.addNormalizedIntentsToSet = function(setToAdd) {
                Object.keys(vm.intent_handler_map).forEach((intentName) => {
                    if (vm.intent_handler_map[intentName] && vm.intent_handler_map[intentName] !== undefined)
                        setToAdd.add(intentName.replace(/\.| /g, '_'));
                });
            };

            vm.validateExistingQnAModel = function(withIntent) {
                vm.existingModelValidation = {};
                var guidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
                var errFieldId = null;
                if (!vm.modelToEdit.model.qnaEndpoint || !vm.modelToEdit.model.qnaEndpoint.trim() === "") {
                    vm.existingModelValidation.qnaEndpoint = "Endpoint is required";
                    errFieldId = errFieldId || '#editQnAHost';
                }
                if (!vm.modelToEdit.model.subscription_key || !vm.modelToEdit.model.subscription_key.trim() === "") {
                    vm.existingModelValidation.subscription_key = "QnA Endpoint key is required";
                    errFieldId = errFieldId || '#editQnAKey';
                }
                else if (!guidRegex.test(vm.modelToEdit.model.subscription_key)) {
                    vm.existingModelValidation.subscription_key = "Invalid QnA Endpoint key";
                    errFieldId = errFieldId || '#editQnAKey';
                }
                if (!vm.modelToEdit.model.kbId || !vm.modelToEdit.model.kbId.trim() === "") {
                    vm.existingModelValidation.kbId = "KnowledgeBase id is required";
                    errFieldId = errFieldId || '#editKnowledgeBaseID';
                }
                else if (!guidRegex.test(vm.modelToEdit.model.kbId)) {
                    vm.existingModelValidation.kbId = "Invalid KnowledgeBase id";
                    errFieldId = errFieldId || '#editKnowledgeBaseID';
                }
                if (withIntent && (!vm.modelToEdit.model.intent || vm.modelToEdit.model.intent.trim() === "")) {
                    vm.existingModelValidation.intent = "Intent is required";
                    errFieldId = errFieldId || '#editQnAIntent';
                }
                else if (vm.modelToEdit.model.intent.includes(" ") || vm.modelToEdit.model.intent.includes(".")) {
                    vm.existingModelValidation.intent = "Intent must not include spaces or dots. Consider using underscores instead.";
                    errFieldId = errFieldId || '#editQnAIntent';
                }
                else if (vm.intent_handler_map[vm.modelToEdit.model.intent] && vm.intent_handler_map[vm.modelToEdit.model.intent] !== undefined && vm.modelToEdit.model.intent !== vm.modelToEdit.model.originalIntent) {
                    vm.existingModelValidation.intent = "This intent is in use by another model. Modify one of the models so intents are unique.";
                    errFieldId = errFieldId || '#editQnAIntent';
                }
                else {
                    const normalizedIntents = new Set(); // This set include the normalized form of the intent names (i.e. dots and spaces are transformed to underscores).
                    vm.addNormalizedIntentsToSet(normalizedIntents); // Fill the set with the normalized values.
                    if (normalizedIntents.has(vm.modelToEdit.model.intent) && vm.modelToEdit.model.intent !== vm.modelToEdit.model.originalIntent.replace(/\.| /g, '_')) {  // We don't consider it as a collision when intent is equal to the normalized form of the original intent.
                        vm.existingModelValidation.intent = "This intent is in use by another model (spaces, dots and underscores are equivalent when comparing intents). Modify one of the models so intents are unique.";
                        errFieldId = errFieldId || '#editQnAIntent';
                    }
                }

                if (errFieldId) {
                    $(errFieldId).trigger("focus");
                    return false;
                }

                return true;
            }
            
            vm.validateExistingIntents = function() {
                vm.existingModelValidation = {};
                var isValid = true;

                vm.modelToEdit.model.intents && vm.modelToEdit.model.intents.forEach(function (intent) { isValid = isValid && intent.warning == null });

                return isValid;
            };

            vm.executeUpdateQnAMode = function() {

            };

            vm.editModel = function() {
                if ((vm.modelToEdit.type === 'custom_regexp_recognizers' || vm.modelToEdit.type === 'builtin_regexp_recognizers') && !vm.validateExistingRegexModel()) {
                    return;
                }
                if (vm.modelToEdit.type === "luis_models" && !vm.validateExistingLuisModel()) {
                    return;
                }
                if ((vm.modelToEdit.type === "luis_models" || vm.modelToEdit.type === "builtin_recognizers") && !vm.validateExistingIntents()) {
                    return;
                }
                if ((vm.modelToEdit.type === "qna_recognizers") && !vm.validateExistingQnAModel(true)) {
                    return;
                }

                vm.closeEditModelForm();
                root.modal.showProgress('Saving model');
                $http.put('./manage/model', vm.modelToEdit).then(function (response) {
                        if (response.status === 200) {
                            vm[vm.modelToEdit.type][vm.modelToEdit.model.name] = response.data.model;
                            delete vm[vm.modelToEdit.type].names;
                            delete vm[vm.modelToEdit.type].list;
                            vm[vm.modelToEdit.type].names = Object.keys(vm[vm.modelToEdit.type]).filter(function(name) { return !name.startsWith("_convict") });
                            vm[vm.modelToEdit.type].list = vm[vm.modelToEdit.type].names.map(function(name) { return vm[vm.modelToEdit.type][name] });

                            vm.intent_handler_map = response.data.intent_handler_map;
                            root.modal.hideProgress();
                            root.toastr.success("Successfully edited language model");
                        } else {
                            root.modal.hideProgress();
                            root.toastr.error("Sorry, an error occurred while saving language model. Please try again later.");
                        }
                    },
                    function (errorResponse) {
                        root.modal.hideProgress();
                        root.toastr.error("Sorry, an error occurred while saving language model. Please try again later.");
                        console.error(errorResponse);
                    })
            };

            vm.updateQnAModal = function(model, name, type) {
                vm.qnaModelToUpdate = { model: JSON.parse(JSON.stringify(model)), type: type };
                vm.qnaModelToUpdate.model.name = name;
                $('#updateQnAModal').modal();
            };

            vm.deleteModel = function(model, name, type) {
                vm.modelToDelete = { model: JSON.parse(JSON.stringify(model)), type: type };
                vm.modelToDelete.model.name = name;
                $('#deleteModelModal').modal();
            };

            vm.executeUpdateQnAModel = function() {
                root.modal.showProgress("Training your QnA model");
                $http.put('./manage/model/update', vm.qnaModelToUpdate).then(function (response) {
                    if (response.status === 200) {
                        root.modal.hideProgress();
                        root.toastr.success("Successfully updated QnA model");
                    } else {
                        root.modal.hideProgress();
                        root.toastr.error("Sorry, an error occurred while updating your QnA model. Please try again later.");
                    }
                },
                    function (errorResponse) {
                        root.modal.hideProgress();
                        root.toastr.error("Sorry, an error occurred while updating your QnA model. Please try again later.");
                        console.error(errorResponse);
                    })
            };

            vm.executeDeleteModel = function() {
                root.modal.showProgress("Deleting model");
                $http.post('./manage/model/delete', vm.modelToDelete).then(function (response) {
                        if (response.status === 200) {
                            delete vm[vm.modelToDelete.type][response.data.name];
                            delete vm[vm.modelToDelete.type].names;
                            delete vm[vm.modelToDelete.type].list;
                            vm[vm.modelToDelete.type].names = Object.keys(vm[vm.modelToDelete.type]).filter(function(name) { return !name.startsWith("_convict") });
                            vm[vm.modelToDelete.type].list = vm[vm.modelToDelete.type].names.map(function(name) { return vm[vm.modelToDelete.type][name] });

                            vm.intent_handler_map = response.data.intent_handler_map;
                            root.modal.hideProgress();
                            root.toastr.success("Successfully deleted language model");
                        } else {
                            root.modal.hideProgress();
                            root.toastr.error("Sorry, an error occurred while deleting language model. Please try again later.");
                        }
                    },
                    function (errorResponse) {
                        root.modal.hideProgress();
                        root.toastr.error("Sorry, an error occurred while deleting language model. Please try again later.");
                        console.error(errorResponse);
                    })
            };

            vm.reset = function() {
                $('#resetModelsModal').modal();
            };

            vm.executeReset = function () {
                root.modal.showProgress('Resetting language models');
                $http.delete('./manage/reset').then(
                    function(response) {
                        root.modal.hideProgress();
                        vm.refresh();
                    },
                    function(response) {
                        root.modal.hideProgress();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while resetting language models list. Please try again");

                    }
                );
            };

            vm.loadingOptions = false;
            vm.localizedStringSearch = function(partOfString) {
                vm.loadingOptions = true;
                return $http.get(location.pathname + "/" +  location.hash.split('/').pop() +  './specificLocalizedStrings?partOfString=' + partOfString).then(
                    function(res) {
                        console.log('f');
                        vm.loadingOptions = false;
                        return res.data;
                    },
                    function(httpError) {
                        vm.loadingOptions = false;
                        return [];
                    }
                );
            };

            vm.localizedStringOnBlurHandler = function(variable, key) {
                if (typeof(variable[key]) === 'string') {
                    variable[key] = {
                        "stringId": null,
                        "en-us": variable[key]
                    }
                }
            };
        });
})();
