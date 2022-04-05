(function() {
    angular.module('adminPortalApp.controllers')
        .controller('scenariosCtrl', function ($rootScope, $window, $scope, $http, $timeout, $moment, localStorageService, $location) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;

            if (!Array.prototype.find) {
                Array.prototype.find = function(boolFunc) {
                    var res;
                    this.forEach(function(item) {
                        if (!res && boolFunc(item)) {
                            res = item;
                        }
                    });
                    return res;
                };
            }

            /**************************************************************************************************
             * Controller strings
             ***************************************************************************************************/
            vm.texts = {};
            vm.texts.validation = {};
            vm.texts.scenarioDelete = {en: "Scenario Deleted"};
            vm.texts.errorOccurred = {en: "An error occurred"};
            vm.texts.failedGetScenarios = {en: "Failed to get scenarios"};
            vm.texts.scenarioActivated = {en: "Scenario activated"};
            vm.texts.scenarioDeactivated = {en: "Scenario deactivated"};
            vm.texts.downloadWillStartSoon = {en: "Your download will start soon"};
            vm.texts.downloadFailed = {en: "Download failed"};
            vm.texts.readOnlyMode = {en: "Read only mode"};
            vm.texts.validation.noValidScenarios = {en: "There are no valid scenarios to import"};
            vm.texts.validation.title = {en: "Import Scenarios"};
            vm.texts.validation.colFileName = {en: "File"};
            vm.texts.validation.colScenarioName = {en: "Name"};
            vm.texts.validation.colScenarioId = {en: "Scenario ID"};
            vm.texts.validation.colInformation = {en: "Information"};
            vm.texts.validation.colValidationResults = {en: "Validation Results"};
            vm.texts.validation.newScenario = {en: "New scenario"};
            vm.texts.validation.existingScenario = {en: "Existing scenario"};
            vm.texts.validation.overwriteScenario = {en: "Overwrite !"};
            vm.texts.validation.validatingScenario = {en: "Validating..."};
            vm.texts.validation.deactivatedScenario = {en: "Deactivated"};
            vm.texts.validation.conflictsFound = {en: "Conflicts found (name or trigger appears twice or more in this import request)"};
            vm.texts.validation.validScenario = {en: "Valid"};
            vm.texts.validation.cancelOperation = {en: "Cancel"};
            vm.texts.validation.validateOperation = {en: "Validate"};
            vm.texts.validation.confirmOperation = {en: "Submit"};
            vm.texts.validation.nameAlreadyUsed = {en: "Name already used"};
            vm.texts.validation.triggerAlreadyUsed = {en: "Trigger already used"};
            vm.texts.validation.invalidScenarioId = {en: "Invalid scenario ID"};
            vm.texts.validation.notScenarioFile = {en: "Not a scenario file"};
            vm.texts.validation.errorReadingFile = {en: "error while preparing your files, please try again."};
            vm.texts.validation.importSuccess = {en: "Scenarios imported successfully"};
            vm.texts.validation.importError = {en: "Errors occurred while importing"};
            vm.texts.scenarioSnapshotMade =  {en: "Snapshort Creared"};
            vm.texts.scenarioSnapshotPromoted =  {en: "Snapshort Promoted"};
            vm.texts.scenarioSnapshotPromotedWithSnapshot =  {en: "Snapshot created and Promoted"};
            vm.texts.scenariosTableColumnSortState = {};

            ['name', 'scenario_trigger', 'description', 'time'].forEach(function (colName) {
                vm.texts.scenariosTableColumnSortState[colName] = colName !== localStorageService.get('scenarios_selectedColumn')
                    ? "unsorted"
                    : localStorageService.get('scenarios_orderDescending')
                        ? "descending"
                        : "ascending"
            });

            vm.isLocalizationEnabled = false;
            vm.localizedStrings = [];
            vm.localizedString = {};

            /**************************************************************************************************
             * applying the pointer to the toastr on page ready event
             ***************************************************************************************************/
            angular.element(document).ready(function () {
                refreshRedirectLockConfirmation();
            });

            var socket = io($location.protocol() + "://" + $location.host() + ":" + $location.port(), {
                query: "tenantId=" + $('#socketioRoomName').val()
            });
            socket.on('notifyEditing', function(e){
                var foundScenario = vm.scenarios.find(function(s) {
                    return s.RowKey === e.id;
                });
                if (foundScenario) {
                    foundScenario.currentUser = e.userName;
                    $scope.$apply();
                }
                refreshRedirectLockConfirmation();
            });
            socket.on('notifyDoneEditing', function(e) {
                var foundScenario = vm.scenarios.find(function(s) {
                    return s.RowKey === e.id;
                });
                if (foundScenario) {
                    foundScenario.currentUser = undefined;
                    $scope.$apply();
                }
                refreshRedirectLockConfirmation();
            });



            function refreshRedirectLockConfirmation() {
                setTimeout(function() {
                    $('.scenariosLinkConfirm').confirmation(
                        {
                            rootSelector: '.scenariosLinkConfirm',   // Required for jQuery >= 3 when using singleton or popout. The selector on which Confirmation is applied. This must be the same selector as provided to $().
                            onShow: function(e, element) {
                                if ($('span', $(element)).length === 0) {
                                    root.modal.show();
                                    window.parent.location = $(element).attr('href');
                                }
                            },
                            onConfirm: function(e, element) {
                                root.modal.show();
                                window.parent.location = $(element).attr('href');

                            },
                            singleton: true,
                            placement:'right',
                            btnOkLabel: 'Continue',
                            btnCancelLabel: 'Cancel',
                            title:'An editor has this scenario open. Would you like to open it as well?'
                        }
                    );
                    // this breaks scenario links
                    // $('.scenariosLinkNonConfirm').confirmation('dispose');
                }, 100)
            }

            /**************************************************************************************************
             * loading data on controller init event
             ***************************************************************************************************/
            vm.selectedColumn = localStorageService.get('scenarios_selectedColumn');
            vm.orderDescending = localStorageService.get('scenarios_orderDescending');
            vm.formatType = "native";

            if(vm.selectedColumn === undefined || vm.selectedColumn === null) {
                vm.selectedColumn = 'name';
                localStorageService.set('scenarios_selectedColumn', 'name');
            }
            if(vm.orderDescending === undefined || vm.orderDescending === null) {
                vm.orderDescending = true;
                localStorageService.set('scenarios_orderDescending', true);

                if (vm.selectedColumn) {
                    vm.texts.scenariosTableColumnSortState[vm.selectedColumn] = "descending";
                }
            }

            vm.noScenarios = false;
            vm.scenarios = [];

            vm.init = function() {
                vm.loadData();
                $('#deleteScenario, #importScenariosModal, #manageSnapshotsModal').on('shown.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                $('#deleteScenario, #importScenariosModal, #manageSnapshotsModal').on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });

                $http.get('./manage/localizationSettings').then(
                    function(response) {
                        vm.isLocalizationEnabled = response.data.isLocalizationEnabled;
                    },
                    function(httpError) {
                        console.error("Error fetching localization settings");
                        console.error(httpError);
                        window.toastr.error("Sorry, an error occurred while reading localization settings. Please try again");
                    }
                );
            };

            vm.loadData = function(cb) {
                root.modal.show();
                $http.get('./manage/all').then(
                    function(response) {
                        vm.scenarios = [];
                        response.data.forEach(function(item, i) {
                            if (item.updated) {
                                item.TimestampString = $moment(item.updated).calendar(null, {
                                    sameDay: '[Today] [at] HH:mm:ss',
                                    nextDay: '',
                                    nextWeek: '',
                                    lastDay: '[Yesterday] [at] HH:mm:ss',
                                    lastWeek: '[Last] dddd [at] HH:mm:ss',
                                    sameElse: 'ddd, MMM Do YYYY, HH:mm:ss'
                                });
                                var x = new Date(item.updated);
                                item.t = x.getTime();
                            }
                            else {
                                item.TimestampString = "";
                                item.t = 0;
                            }
                            item.selected = false;
                            item.scenario_trigger = item.scenario_trigger || "";
                            item.pendingDelete = false;
                            vm.scenarios.push(item);
                        });
                        if (vm.scenarios.length === 0) {
                            $('#scenarios-welcome').removeClass("d-none");
                            $('#scenarios-list').addClass("d-none");
                            vm.noScenarios = true;
                        }
                        else if (vm.selectedColumn && vm.selectedColumn.length > 0) {
                            $('#scenarios-welcome').addClass("d-none");
                            $('#scenarios-list').removeClass("d-none");
                            vm.orderBy(vm.selectedColumn);
                        }
                        root.modal.hide();
                        refreshRedirectLockConfirmation();
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.modal.hide();
                        vm.noScenarios = true;
                        root.refreshTabIndices();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading scenario list. Please try again");
                    }
                );
            };

            vm.update = function(name) {
                if (name !== vm.selectedColumn) {
                    localStorageService.set('scenarios_selectedColumn', name);
                    localStorageService.set('scenarios_orderDescending', true);
                    for (const colName in vm.texts.scenariosTableColumnSortState) {
                        vm.texts.scenariosTableColumnSortState[colName] = 'unsorted';
                    }
                    vm.texts.scenariosTableColumnSortState[name] = "descending";
                } else {
                    vm.orderDescending = !vm.orderDescending;
                    vm.texts.scenariosTableColumnSortState[name] = vm.orderDescending ? "descending" : "ascending";
                    localStorageService.set('scenarios_orderDescending', vm.orderDescending);
                }
                vm.selectedColumn = localStorageService.get('scenarios_selectedColumn');
                vm.orderDescending = localStorageService.get('scenarios_orderDescending');
                vm.orderBy();
            };

            vm.orderBy = function() {
                vm.scenarios.sort(vm.compareFunctions[vm.selectedColumn]);
            };

            vm.compareFunctions = {
                name: function(a,b) {
                    var aa = a.name.toLowerCase();
                    var bb = b.name.toLowerCase();
                    if (aa === bb) return 0;
                    return ((aa < bb) ? -1 : 1) * (vm.orderDescending ? 1 : -1);
                },
                description: function(a,b) {
                    var aa = a.description.toLowerCase();
                    var bb = b.description.toLowerCase();
                    if (aa === bb) return 0;
                    return ((aa < bb) ? -1 : 1) * (vm.orderDescending ? 1 : -1);
                },
                scenario_trigger: function(a,b) {
                    var aa = a.scenario_trigger.toLowerCase();
                    var bb = b.scenario_trigger.toLowerCase();
                    if (aa === bb) return 0;
                    return ((aa < bb) ? -1 : 1) * (vm.orderDescending ? 1 : -1);
                },
                time: function(a,b) {
                    var aa = a.t;
                    var bb = b.t;
                    if (aa === bb) return 0;
                    return ((aa < bb) ? -1 : 1) * (vm.orderDescending ? 1 : -1);
                }
            };

            vm.activeToggle = function(scenario) {
                scenario.active = !scenario.active;
                root.modal.show(scenario.active ? "Activating scenario" : "Deactivating scenario");
                $http({
                    method: 'POST',
                    url: scenario.active ? './manage/'+scenario.RowKey+'/activate' : './manage/'+scenario.RowKey+'/deactivate'
                }).then(function successCallback(response) {
                    root.modal.hide();
                    if (response.status === 200) {
                        return root.toastr.success((scenario.active) ? vm.texts.scenarioActivated.en : vm.texts.scenarioDeactivated.en);
                    } else {
                        root.toastr.error("Sorry, an error occurred while " + scenario.active ? "activating" : "deactivating" + " scenario. Please try again");
                        scenario.active = !scenario.active;
                    }
                }, function errorCallback(response) {
                    root.modal.hide();
                    scenario.active = !scenario.active;
                    if (response.status === 403) {
                        return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data);
                    }
                    else if (response.status === 500) {
                        for (var issue_index = 0; issue_index < response.data.length; issue_index++) {
                            var issue = response.data[issue_index];
                            switch (issue.severity) {
                                case "warning":
                                    return root.toastr.warning(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                case "problem":
                                    return root.toastr.error(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                case "error":
                                    return root.toastr.error(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                default:
                                    root.toastr.error("Sorry, an error occurred while " + (scenario.active ? "deactivating" : "activating") + " scenario. Please try again");
                            }
                        }
                    }
                    else {
                        root.toastr.error("Sorry, an error occurred while " + (scenario.active ? "deactivating" : "activating") + " scenario. Please try again");
                    }
                });

            };
            vm.allSelected = false;
            vm.selectedCounter = 0;
            vm.selectAll = function() {
                vm.allSelected = !vm.allSelected;
                vm.scenarios.forEach(function(item) {
                    item.selected = vm.allSelected;
                });
                vm.selectedCounter = vm.allSelected ? vm.scenarios.length : 0;
            };
            vm.select = function(scenario) {
                scenario.selected = !scenario.selected;
                vm.allSelected = false;
                vm.selectedCounter += scenario.selected ? +1 : -1;
            };

            vm.exportScenarios = function(action) {
                if (action === 'begin') {
                    root.openDrawer("exportScenarios");
                }
                else if (action === 'cancel') {
                    root.closeDrawer("exportScenarios");
                }
                else if (action === 'export') {
                    if(vm.selectedCounter === 0) {
                        root.toastr.warning("Nothing to export");
                        return;
                    }
                    root.toastr.info("Exporting selected scenarios...");
                    var data = {
                        names : [],
                        time: $moment().format()
                    };
                    vm.scenarios.forEach(function(scenario) {
                        if (scenario.selected) {
                            data.names.push(scenario.name);
                        }
                    });
                    function getFileNameFromHeader(header){
                        if (!header) {
                            return null;
                        }
                        var result= header.split(";")[1].trim().split("=")[1];
                        return result.replace(/"/g, '');
                    }
                    root.modal.show();
                    var mimeType = data.names.length > 1 ? 'application/zip' : 'application/json';
                    $http({
                        method: 'POST',
                        url: './manage/export?format=' + vm.formatType,
                        data: data,
                        headers: {
                            accept: mimeType
                        },
                        responseType: 'arraybuffer',
                        cache: false,
                        transformResponse: function(data, headers) {
                            var d = null;
                            if (data) {
                                d = new Blob([data], {
                                    type: mimeType
                                });
                            }
                            var fileName = getFileNameFromHeader(headers('content-disposition'));
                            var result = {
                                blob: d,
                                fileName: fileName
                            };
                            return {
                                response: result
                            };
                        }
                    }).then(function successCallback(response) {
                        root.modal.hide();
                        root.closeDrawer("exportScenarios");
                        var blob = response.data.response.blob;
                        var fileName = response.data.response.fileName.trim() || 'scenarios.zip';
                        var link=document.createElement('a');
                        link.href=window.URL.createObjectURL(blob);
                        link.download = fileName;
                        link.click();
                    }, function errorCallback(response) {
                        root.modal.hide();
                        root.closeDrawer("exportScenarios");
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while exporting selected scenarios. Please try again");
                    });
                }
            };

            $("#fileReaderButton").on('change',function(result){
                root.fileName = result.target.files[0].name;
            });

            vm.pickFilesToImport = function() {
                document.getElementById('fileReaderButton').click();
            };

            vm.dismissImport = function () {
                $("#fileReaderButton").val("");
            };

            vm.showContent = function(fileContent) {
                var vmHook = this;
                vmHook.importAllSelected = false;
                getScenariosList(function(err, res) {
                    if (err) {
                        return root.toastr.error(err);
                    }
                    var scenariosToImport = fileContent.res;
                    scenariosToImport.forEach(function(scenario) {
                        if (!scenario.valid) {
                            return;
                        }
                        if (res.filter(function(item) {
                            return (item.name === scenario.scenarioName && item.scenario_trigger === scenario.scenarioTrigger);
                        }).length > 0) {
                            scenario.exists = true;
                        }
                        else if (res.filter(function(item) { return (item.name === scenario.scenarioName);}).length > 0) {
                            scenario.exists = false;
                            scenario.valid = false;
                            scenario.message = vm.texts.validation.nameAlreadyUsed.en;

                        }
                        else if (res.filter(function(item) { return (item.scenario_trigger === scenario.scenarioTrigger);}).length > 0) {
                            scenario.exists = false;
                            scenario.valid = false;
                            scenario.message = vm.texts.validation.triggerAlreadyUsed.en;
                        }
                        else if (!vmHook.validateScenarioId(scenario.scenarioTrigger)) {
                            scenario.exists = false;
                            scenario.valid = false;
                            scenario.message = vm.texts.validation.invalidScenarioId.en;
                        }
                        else {
                            scenario.exists = false;
                        }
                    });

                    var form = new FormData();
                    scenariosToImport.forEach(function(scenario) {
                        if (scenario.valid) {
                            form.append(scenario.scenarioName, scenario._file);
                        }
                    });
                    form.append("schemeOnly", true);
                    root.modal.show("Importing scenarios");
                    $http({
                        method: 'POST',
                        url: './manage/validatescenarioimport',
                        data: form,
                        headers: { 'Content-Type': undefined},
                        transformRequest: angular.identity
                    }).then(function successCallback(response) {
                        // if there was an error with the basic validation process, message and quit the process
                        if (response.status !== 200) {
                            return root.toastr.error(vm.texts.validation.errorReadingFile.en)
                        }
                        scenariosToImport.forEach(function(scenario) {
                            // invalidated all the broken or out of scheme scenarios. we do not allow importing such scenarios
                            if (!scenario.valid) {
                                scenario.message = scenario.message || vm.texts.validation.notScenarioFile.en;
                            }
                            else if (!response.data[scenario.scenarioName].valid) {
                                scenario.valid = false;
                                scenario.message = response.data[scenario.scenarioName].message
                            } else {
                                scenario.message = "";
                            }

                            // if valid - set a baseline for the scenario object
                            if (scenario.valid) {
                                scenario.selected = scenario.valid && !scenario.exists;
                                scenario.validation = {
                                    validating: false,
                                    validated: false,
                                    error: false,
                                    problem: false,
                                    conflict: false,
                                    warning: false,
                                    ok: false
                                };
                                scenario.message = "";
                            }
                        });

                        if (scenariosToImport.filter(function(scenario) { return scenario.valid}).length === 0) {
                            root.toastr.error(vm.texts.validation.noValidScenarios.en)
                        }
                        vmHook.scenariosToImport = scenariosToImport;
                        vmHook.scenariosToImportAtLeastOneSelected = importSelectionCount(vmHook);
                        root.modal.hide();
                        $('#importScenariosModal').appendTo("body").modal({backdrop: 'static', keyboard: false});
                        if (!conflictsTracker() && vmHook.scenariosToImportAtLeastOneSelected) {
                            vmHook.validateScenariosToImport();
                        }
                        else {
                            vmHook.scenariosToImportValidated = false;
                        }

                    }, function errorCallback(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while importing scenarios. Please try again");
                    });

                });
            };

            function importSelectionCount(vm) {
                var selected = vm.scenariosToImport.filter(function(scenario) { return scenario.selected });
                return (selected.length > 0);
            }

            function conflictsTracker() {
                var conflictsFound = false;
                for (var i = 0; i < vm.scenariosToImport.length; i++) {
                    if (vm.scenariosToImport[i].problem || !vm.scenariosToImport[i].selected) {
                        continue;
                    }
                    for (var j = i + 1; j < vm.scenariosToImport.length; j++) {
                        if (!vm.scenariosToImport[j].selected) {
                            continue;
                        }
                        if (vm.scenariosToImport[i].scenarioName === vm.scenariosToImport[j].scenarioName || vm.scenariosToImport[i].scenarioTrigger === vm.scenariosToImport[j].scenarioTrigger) {
                            vm.scenariosToImport[i].validation.validated = true;
                            vm.scenariosToImport[j].validation.validated = true;
                            vm.scenariosToImport[i].validation.conflict = true;
                            vm.scenariosToImport[j].validation.conflict = true;
                            conflictsFound = true;
                        }
                    }
                }
                return conflictsFound;
            }

            vm.toggleImportSelection = function(scenario) {
                if (!scenario.valid) {
                    return;
                }
                scenario.selected = !scenario.selected;

                vm.scenariosToImport.forEach(function (s) {
                    if (s.valid) {
                        s.validation = {
                            validating: false,
                            validated: false,
                            error: false,
                            problem: false,
                            conflict: false,
                            warning: false,
                            ok: false
                        };
                        s.message = "";
                    }
                });
                var conflictsFound = conflictsTracker();
                vm.scenariosToImportValidated = false;
                if (!conflictsFound) {
                    vm.scenariosToImportValidated = false;
                    vm.importAllSelected = false;
                    vm.scenariosToImportAtLeastOneSelected = importSelectionCount(vm);
                    vm.validateScenariosToImport();
                }
            };

            vm.importToggleAll = function() {
                vm.importAllSelected = !vm.importAllSelected;
                vm.scenariosToImport.forEach(function(scenario){
                    if (scenario.valid) {
                        scenario.validation = {
                            validating: false,
                            validated: false,
                            error: false,
                            problem: false,
                            warning: false,
                            ok: false
                        };
                        scenario.message = "";
                        scenario.selected = scenario.valid && vm.importAllSelected;
                    }
                });
                vm.scenariosToImportAtLeastOneSelected = importSelectionCount(vm);
                vm.validateScenariosToImport();
            };

            vm.validateScenariosToImport = function() {
                var thisValidationStartedAt = new Date().getTime();
                vm.lastValidationStartedAt = thisValidationStartedAt;
                var vmHook = this;
                var form = new FormData();
                vmHook.scenariosToImport.forEach(function(scenario) {
                    if (scenario.selected) {
                        scenario.validation.validated = false;
                        scenario.validation.validating = true;
                        scenario.validation.message = "";
                        form.append(scenario.scenarioName, scenario._file);
                    }
                });
                $http({
                    method: 'POST',
                    url: './manage/validatescenarioimport',
                    data: form,
                    headers: { 'Content-Type': undefined},
                    transformRequest: angular.identity
                }).then(function successCallback(response) {
                    // if this is not the last fired validation, do not use those results.
                    if (thisValidationStartedAt !== vm.lastValidationStartedAt) { return ; }
                    // if there was an error with the basic validation process, message and quit the process
                    if (response.status !== 200) {
                        return root.toastr.error(vm.texts.validation.errorReadingFile.en);
                    }
                    // invalidated all the broken or out of scheme scenarios. we do not allow importing such scenarios
                    vmHook.scenariosToImport.forEach(function (scenario) {
                        if (scenario.selected) {
                            scenario.validation.validating = false;
                            scenario.validation.validated = true;
                            var resObj = response.data[scenario.scenarioName];

                            switch (resObj.severity) {
                                case "error":
                                case "problem":
                                    scenario.validation.problem = true;
                                    scenario.message = resObj.message;
                                    break;
                                case "warning":
                                    scenario.validation.warning = true;
                                    scenario.message = resObj.message;
                                    break;
                                default:
                                    scenario.validation.ok = true;
                                    scenario.message = vm.texts.validation.validScenario.en;
                                    break;
                            }
                        }
                    });
                    vmHook.scenariosToImportValidated = !conflictsTracker() && vm.scenariosToImportAtLeastOneSelected;

                }, function errorCallback(response) {
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while reading imported scenarios. Please try again");
                });
            };

            function getScenariosList(cb) {
                root.modal.show();
                $http({
                    method: 'GET',
                    url: './manage/all'
                }).then(function successCallback(response) {
                    root.modal.hide();
                    cb(null, response.data);
                }, function errorCallback(err) {
                    root.modal.hide();
                    cb(err, null);
                });
            }

            vm.executeImport = function() {
                var form = new FormData();
                vm.scenariosToImport.forEach(function(scenario) {
                    if (scenario.valid && scenario.selected) {
                        form.append(scenario.scenarioName, scenario._file);
                        form.append('active#' + scenario.scenarioName, scenario.validation.ok);
                    }
                });
                $('#importScenariosModal').modal('hide');
                root.modal.show('Importing scenarios');
                $http({
                    method: 'POST',
                    url: './manage/import',
                    data: form,
                    headers: { 'Content-Type': undefined},
                    transformRequest: angular.identity
                }).then(function successCallback(response) {
                    root.modal.hide();
                    if (response.status !== 200) {
                        root.toastr.error(response.status + ': ' + response.data);
                        setTimeout(function() {
                            $('#importScenariosModal').modal('show');
                            root.refreshTabIndices();
                            },1000);
                    } else {
                        vm.dismissImport();
                        root.toastr.success(vm.texts.validation.importSuccess.en);
                        $timeout(function () {
                            vm.loadData();
                        },500);
                    }
                }, function errorCallback(response) {
                    root.modal.hide();
                    $timeout(function () {
                        vm.loadData();
                    },500);
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while importing scenarios. Please try again");
                });
            };

            vm.validateScenarioId = function(text) {
                // allow only letters, numbers or underscores
                return text.search(/[^a-z,^A-Z,^0-9,^\/,^\\,^_]/) < 0;
            };

            vm.addNewScenario = function(action, i) {
                if (!action) {
                    vm.validation = {
                        name: null,
                        trigger: null
                    };
                    vm.newScenario = {
                        name: "",
                        description: "",
                        trigger: "",
                        returningMessage: "",
                        interrupting: false,
                        breaking: false
                    };
                    root.openDrawer("newScenarioDrawer");
                }
                else if (action == 'cancel') {
                    root.closeDrawer("newScenarioDrawer");
                }
                else if (action == 'validate') {
                    vm.validation = {
                        name: (vm.newScenario.name !== undefined && vm.newScenario.name.trim().length) > 0 ? null : "A unique name is required for identifying this scenario",
                        trigger: (vm.newScenario.trigger === undefined || vm.newScenario.trigger.trim().length === 0
                            || !vm.validateScenarioId(vm.newScenario.trigger)) ? "A unique scenario id is required for identifying this scenario. It should include letters, numbers or underscores only." : null
                    };
                    if (vm.validation.name) {
                        $('#name').trigger("focus");
                        return;
                    } else if(vm.validation.trigger) {
                        $('#trigger').trigger("focus");
                        return;
                    }
                    root.modal.show("Creating scenarios");
                    $http.post('./manage/add', vm.newScenario).then(
                        function (response) {
                            root.modal.hide();
                            root.closeDrawer("newScenarioDrawer");
                            setTimeout(function() { root.modal.show();
                                location.href = location.href + "./../../scenario-editor/" + response.data;
                            }, 500);
                            root.toastr.success("Scenario created, loading scenario editor");
                        },
                        function (response) {
                            root.modal.hide();
                            if (response.status === 400) {
                                response.data.forEach(function (field) {
                                    switch(field) {
                                        case 'name':
                                            vm.validation.name = "A unique name is required for identifying this scenario";
                                            break;
                                        case 'trigger':
                                            vm.validation.trigger = "A unique trigger is required for identifying this scenario";
                                            break;
                                    }
                                });
                            }
                            else {
                                if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                                root.toastr.error("Sorry, an error occurred while creating new scenario. Please try again");
                            }
                        }
                    );
                }
            };


            /**
             * The function handles a press on 'Clone' button, or 'Create/'Cancel' in the clone window.
             * @param action - can be 'begin', 'cancel' or 'validate'.
             * @param id - the scenario Id of the scenario we want to clone.
             */
            vm.cloneScenario = function(action, id) {
                if (action === "begin") { //If user pressed the 'Clone' button in the main portal window
                    root.modal.show("Reading scenario"); //show the animation of 'Reading Scenario', until http response returns
                    $http.get('./manage/clone/' + id).then(
                        function (response) { // If response was successful
                            root.modal.hide(); //http returned - hide animation
                            root.toastr.clear();
                            if (response.status === 200) {
                                //Initialize validation object
                                vm.validation = {
                                    name: null,
                                    trigger: null
                                };
                                //Get information of current scenario with suggested Name and Trigger (ID)
                                vm.currentScenario = {
                                    id: id,
                                    name: response.data.name,
                                    description: response.data.description,
                                    trigger: response.data.trigger,
                                    returningMessage: response.data.returningMessage,
                                    interrupting: response.data.interrupting,
                                    breaking: response.data.breaking
                                };

                                if (response.data.returningMessage?.stringId) {
                                    if (vm.isLocalizationEnabled) {
                                        vm.localizedString = {
                                            _tenant: {
                                                stringId: response.data.returningMessage.stringId,
                                                "en-us": response.data.returningMessage['en-us']
                                            }
                                        };
                                    } else {
                                        vm.currentScenario.returningMessage = response.data.returningMessage['en-us']
                                    }

                                }
                                root.openDrawer("cloneScenarioDrawer");
                            } else { //there was an error
                                root.toastr.error(response.data);
                            }
                        },
                        function (response) { // If response was unsuccessful
                            root.modal.hide();
                            if (response.status === 403) {
                                return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data);
                            }
                            root.toastr.error("Sorry, an error occurred while reading scenario. Please try again");
                        });
                }
                else if (action === "cancel") { //If the user pressed 'Cancel' button in the drawer of 'clone'.
                    root.closeDrawer("cloneScenarioDrawer");
                    vm.currentScenario = null;
                }
                else if (action === "validate") { //If the user pressed 'Create' button in the drawer of 'clone'.
                    //Create the validation object and make sure that name and id are not empty.
                    vm.validation = {
                        name: (vm.currentScenario.name !== undefined && vm.currentScenario.name.trim().length) > 0 ? null : "A unique name is required for identifying this scenario",
                        trigger: (vm.currentScenario.trigger === undefined || vm.currentScenario.trigger.trim().length === 0
                            || !vm.validateScenarioId(vm.currentScenario.trigger)) ? "A unique scenario id is required for identifying this scenario. It should include letters, numbers or underscores only." : null
                    };
                    if (vm.validation.name || vm.validation.trigger) { //Check that after trimming, the name and ID are not empty.
                        return;
                    }
                    root.modal.show("Cloning scenario");
                    //Now vm.currentScenario holds all the information of our required scenario. Make a post request in order to clone.
                    const requestPath = "./manage/" + vm.currentScenario.id + "/clone";
                    $http.post(requestPath, vm.currentScenario).then(
                        function (response) { // If response was successful
                            root.modal.hide();
                            if (response.status === 200) {
                                root.closeDrawer("cloneScenarioDrawer");
                                setTimeout(function() { root.modal.show();
                                    location.href = location.href + "./../../scenario-editor/" + response.data;
                                }, 500);
                                root.toastr.success("Scenario cloned, loading scenario editor");
                            }
                            else {
                                root.toastr.error("Sorry, an error occurred while cloning the scenario. Please try again");
                            }
                        },
                        function (response) { // If response was unsuccessful
                            root.modal.hide();
                            if (response.status === 403) {
                                return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data);
                            }
                            else if (response.status === 400) { // If name and/or ID were in use, this status is returned
                                response.data.forEach(function (field) {
                                    switch (field) {
                                        case 'name':
                                            vm.validation.name = "A unique name is required for identifying this scenario";
                                            break;
                                        case 'trigger':
                                            vm.validation.trigger = "A unique trigger is required for identifying this scenario";
                                            break;
                                    }
                                });
                            }
                            else {
                                root.toastr.error("Sorry, an error occurred while cloning the scenario. Please try again");
                            }

                        }
                    );

                }
            }



            vm.editScenario = function(action, id) {
                if (action === 'begin') {
                    root.modal.show("Reading scenario");
                    $http.get('./manage/' + id).then(
                        function(response) {
                            root.modal.hide();
                            root.toastr.clear();
                            if (response.status === 200) {
                                vm.validation = {
                                    name: null,
                                    trigger: null
                                };
                                vm.currentScenario = {
                                    id: id,
                                    name: response.data.name,
                                    description: response.data.description,
                                    trigger: response.data.trigger,
                                    returningMessage: response.data.returningMessage,
                                    interrupting: response.data.interrupting,
                                    breaking: response.data.breaking
                                };

                                if (response.data.returningMessage?.stringId) {
                                    if (vm.isLocalizationEnabled) {
                                        vm.localizedString = {
                                            _tenant: {
                                                stringId: response.data.returningMessage.stringId,
                                                "en-us": response.data.returningMessage['en-us']
                                            }
                                        };
                                    } else {
                                        vm.currentScenario.returningMessage = response.data.returningMessage['en-us']
                                    }
                                }
                                root.openDrawer("editScenarioDrawer");
                            }
                            else {
                                root.toastr.error(response.data);
                            }
                        },
                        function(response) {
                            root.modal.hide();
                            if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                            root.toastr.error("Sorry, an error occurred while reading scenario. Please try again");
                        });
                }
                else if (action == 'cancel') {
                    root.closeDrawer("editScenarioDrawer");
                }
                else if (action == 'validate') {
                    vm.validation = {
                        name: (vm.currentScenario.name !== undefined && vm.currentScenario.name.trim().length) > 0 ? null : "A unique name is required for identifying this scenario",
                        trigger: (vm.currentScenario.trigger === undefined || vm.currentScenario.trigger.trim().length === 0
                            || !vm.validateScenarioId(vm.currentScenario.trigger)) ? "A unique scenario id is required for identifying this scenario. It should include letters, numbers or underscores only." : null
                    };
                    if (vm.validation.name || vm.validation.trigger) {
                        return;
                    }
                    root.modal.show("Updating scenario");
                    $http.put('./manage/' + vm.currentScenario.id, vm.currentScenario).then(
                        function (response) {
                            root.modal.hide();
                            if (response.status === 200) {
                                root.toastr.success("Scenario updated");
                                root.closeDrawer("editScenarioDrawer");
                                vm.loadData();
                            }
                            else {
                                root.toastr.error("Sorry, an error occurred while updating scenario. Please try again");
                            }
                        },
                        function (response) {
                            root.modal.hide();
                            if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                            else if (response.status === 400) { // If name and/or ID were in use, this status is returned
                                response.data.forEach(function (field) {
                                    switch(field) {
                                        case 'name':
                                            vm.validation.name = "A unique name is required for identifying this scenario";
                                            break;
                                        case 'trigger':
                                            vm.validation.trigger = "A unique trigger is required for identifying this scenario";
                                            break;
                                    }
                                });
                            }
                            else {
                                root.toastr.error("Sorry, an error occurred while updating scenario. Please try again");
                            }

                        }
                    );
                }
            };

            vm.scenariosToDelete = [];
            vm.showDelete = function(scenario) {
                if (scenario) {
                    vm.scenariosToDelete = [scenario];
                }
                else {
                    vm.scenariosToDelete = vm.scenarios.filter(function(scenario) {
                        return scenario.selected;
                    });
                }
                if (vm.scenariosToDelete.length > 0) {
                    $('#deleteScenario').modal();
                }
            };

            vm.snapshotIdToString = function(snapshotId) {
                return $moment(snapshotId).format('MMMM Do YYYY, h:mm:ss a')
            }

            vm.manageSnapshots = function(scenario) {
                root.modal.show();
                $http.get('./manage/snapshot/' + scenario.RowKey).then(function(response) {
                    root.modal.hide();
                    vm.managedScenarioSnapshots = scenario;
                    vm.snapshots = response.data;
                    vm.snapshotItems = [];
                    vm.snapshots.forEach(function(snapshot) {
                        vm.snapshotItems.push({
                            utcTime: snapshot.snapshot,
                            localTime : vm.snapshotIdToString(snapshot.snapshot)
                        });
                    });
                    vm.snapshotItems = vm.snapshotItems.sort((a, b) => {
                        var a1 = new Date(a.utcTime);
                        var b1 = new Date(b.utcTime);
                        return a1 > b1 ? -1 : a1 <b1 ? 1 : 0;
                    });
                    $('#manageSnapshotsModal').modal();

                },
                function(response) {
                    root.modal.hide();
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while reading snapshots data. Please try again");
                });
            };

            vm.selectForCompare = function(snapshotItem) {
                snapshotItem.selected = !snapshotItem.selected;
                vm.selectedSnapshots = 0;
                // Count the number of snapahots selected to be compared
                vm.snapshotItems.forEach(function(s) {
                    if (s.selected) {
                        vm.selectedSnapshots++;
                    }
                });
            }

            vm.deleteSnapshot = function(snapshotId) {
                $('#deleteSnapshotModal').modal();
                vm.snapshotStringToDelete = vm.snapshotIdToString(snapshotId);
                vm.snapshotToDelete = snapshotId;
            };

            vm.executeDeleteSnapshot = function(scenario) {
                root.modal.show();
                $http.delete('./manage/snapshot/' + scenario.RowKey + "/" + vm.snapshotToDelete).then(function (response) {
                    $http.get('./manage/snapshot/' + scenario.RowKey).then(function(response1) {
                        root.modal.hide();
                        if (response1.data.length === 0) {
                            vm.loadData();
                            $('#manageSnapshotsModal').modal("hide");
                        }
                        else {
                            root.modal.hide();
                            vm.manageSnapshots(scenario);
                        }
                    },
                    function(httpError) {
                        root.modal.hide();
                    });
                },
                function (httpError) {
                    root.modal.hide();
                });
            };

            vm.nextDiff = function() {
                vm.diffNavigator.next();
            }

            vm.prevDiff = function() {
                vm.diffNavigator.previous();
            }

            vm.compareSnapshots = function(scenario) {
                var selectedSnapshots = vm.snapshotItems.filter(function(s) {
                    return s.selected;
                });
                // Get only the selected snapahots
                vm.compareSnapshotWithSnapshot(scenario, selectedSnapshots[1].utcTime, selectedSnapshots[0].utcTime);

            };

            vm.compareSnapshotWithBase = function(scenario, snapshotId) {
                vm.compareSnapshotWithSnapshot(scenario, snapshotId, undefined);
            };

            vm.compareSnapshotWithSnapshot = function(scenario, snapshotId1, snapshotId2 ) {
                root.modal.show();                
                // Empty the old diff editor
                $("#diffeditor").empty();
                vm.comparedSnapshotId1 = vm.snapshotIdToString(snapshotId1);                
                vm.comparedSnapshotId2 = snapshotId2 ? vm.snapshotIdToString(snapshotId2) : 'current';
                var url = snapshotId2 ? './manage/snapshot/compare/' + scenario.RowKey + "/" + snapshotId1 + "/" + snapshotId2 :
                                        './manage/snapshot/compare/' + scenario.RowKey + "/" + snapshotId1;

                $http.get(url).then(function(response) {
                    var originalModel = monaco.editor.createModel(response.data.snapshot1, "application/json");
                    var modifiedModel = monaco.editor.createModel(response.data.snapshot2, "application/json");
                    $('#comparesnapshotsModal').modal();
                    setTimeout(function() {
                        var diffEditor = monaco.editor.createDiffEditor(document.getElementById("diffeditor"));
                        diffEditor.setModel({
                            original: originalModel,
                            modified: modifiedModel                        
                        });            
                        vm.diffNavigator = monaco.editor.createDiffNavigator(diffEditor, {
                            followsCaret: true,     // resets the navigator state when the user selects something in the editor
                            ignoreCharChanges: true // jump from line to line
                        });
                        root.modal.hide();                    
                    }, 300);
                }, function(response) {
                    root.modal.hide();
                    root.toastr.error("Sorry, an error occurred while comparing snapshot. Please try again");
                });
            }

            vm.viewSnapshot = function(scenario, snapshotId) {
                root.modal.show();                
                // Empty the old diff editor
                $("#snapshotview").empty();
                vm.comparedSnapshotId1 = vm.snapshotIdToString(snapshotId);                
                var url = './manage/snapshot/code/' + scenario.RowKey + "/" + snapshotId;

                $http.get(url).then(function(response) {
                    $('#viewSnapshotModal').modal();
                    setTimeout(function() {
                        monaco.editor.create(document.getElementById("snapshotview"), {
                            value: JSON.stringify(response.data, undefined, '  '),
                            language: "application/json",
                            scrollBeyondLastLine: false,
                            minimap: {
                                enabled:false
                            },                        
                            readOnly: true,
                        });
                        root.modal.hide();                    
                    }, 300);
                }, function(response) {
                    root.modal.hide();
                    root.toastr.error("Sorry, an error occurred while getting snapshot. Please try again");
                });
            }

            vm.promoteSnapshot = function(snapshotId) {
                $('#promoteSnapshotModal').modal();
                vm.snapshotStringToPromote = vm.snapshotIdToString(snapshotId);
                vm.snapshotToPromote = snapshotId;
            };
            
            vm.executePromoteSnapshot = function(scenario) {
                root.modal.show();
                $http.post('./manage/snapshot/promote/' + scenario.RowKey + "/" + vm.snapshotToPromote + "?snapshot=true").then(function(response) {
                    root.modal.hide();
                    root.toastr.success(vm.texts.scenarioSnapshotPromotedWithSnapshot.en);
                    vm.loadData();
                    $('#manageSnapshotsModal').modal("hide");
                },
                function(response) {
                    root.modal.hide();
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while promoting snapshot. Please try again");
                });
                return true;
            };

            vm.executeDelete = function () {
                $('#deleteScenario').modal('hide');
                root.modal.show();
                $http.post('./manage/delete', {
                    ids: vm.scenariosToDelete.map(function(scenario) { return scenario.RowKey;})
                }).then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success(vm.texts.scenarioDelete.en);

                            vm.loadData();
                        } else {
                            root.toastr.error("Sorry, an error occurred while deleting scenario. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while deleting scenario. Please try again");
                    }
                );
            };

            vm.nav = function () {
                root.modal.show();
            };

            vm.navigateTo = function(chosenSection) {
                var url;
                switch (chosenSection) {
                    case 'catalog':
                        url = "./../catalog";
                        break;
                    default:
                        url = "./../../configuration/medical";
                        break;
                }
                $window.location.href = $window.location.href + url;
            };

            vm.localizedStringSelected = function(action) {
                if (action === 'new' && vm.newScenario) {
                    vm.newScenario.returningMessage = vm.localizedString._tenant.stringId
                        ? vm.localizedString._tenant : "";
                } else if ((action === 'clone' || action === 'edit') && vm.currentScenario) {
                    vm.currentScenario.returningMessage = vm.localizedString._tenant.stringId
                        ? vm.localizedString._tenant : "";
                }
            };

            vm.refreshStrings = function(partOfString) {
                return $http.get(location.pathname + "/" +  location.hash.split('/').pop() +  './specificLocalizedStrings?partOfString=' + partOfString).then(
                    function(res) {
                        vm.localizedStrings = res.data && res.data.length > 0 ? ([{
                            stringId: "",
                            "en-us": ""
                        }]).concat(res.data) : [];
                    },
                    function(httpError) {
                        console.error(httpError);
                    }
                );
            };

            vm.saveNewString = function(select, action) {
                select = select || {};
                select.refreshing = true;
                $http.post(location.pathname + "/" +  location.hash.split('/').pop() +  './saveNewString', {value: select.search}).
                then(function onSuccess(response) {
                    var data = response.data;
                    var status = response.status;

                    if (status > 299) {
                        window.toastr.error("Sorry, an error occurred while adding localized string. Please try again later");
                    } else {
                        vm.localizedString._tenant = {};
                        vm.localizedString._tenant['en-us'] = data['en-us'];
                        vm.localizedString._tenant.stringId = data['string Id'];
                        vm.localizedStringSelected(action);
                        select.refreshing = false;
                        select.close();
                    }
                }, function onError(response) {
                    select.refreshing = false;
                    window.toastr.error("Sorry, an error occurred while adding localized string. Please try again later");
                    console.error(response);
                });
            };
        });
})();
