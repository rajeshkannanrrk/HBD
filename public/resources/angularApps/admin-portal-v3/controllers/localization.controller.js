
(function() {
    angular.module('adminPortalApp.controllers')
        .controller('localizationCtrl', function ($rootScope, $window, $scope, $http, $timeout, $moment, localStorageService, $location) {
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
                }
            }

            $window.onbeforeunload = function (e) {
                var msg = undefined;
                if (vm.stringChanges && vm.stringChanges.count > 0) {
                    e.preventDefault();
                    msg = 'Some changes are not saved and will be lost.';
                    e.returnValue = msg;
                }

                return msg;
            };

            /**************************************************************************************************
             * Controller strings
             ***************************************************************************************************/
            vm.texts = {};
            vm.texts.validation = {};

            /**************************************************************************************************
             * loading data on controller init event
             ***************************************************************************************************/
            vm.localizationType = localStorageService.get("localizationType") || "custom";
            vm.stringIdSearchRegexp = { value: "" };
            vm.defaultLocale = "en-us";
            vm.selectedLocale = "en-us";
            vm.isLocalizationEnabled = false;
            vm.newLocale = "";
            vm.newStringId = "";
            vm.newDefaultLocaleValue = "";
            vm.newSelectedLocaleValue = "";
            vm.languagesObject = {};
            vm.data = {};
            vm.data.system = { locales: ["en-us"], strings: [] };
            vm.data.custom = { locales: ["en-us"], strings: []};
            vm.allLocales = new Set();
            vm.activeChanges = 0;
            vm.init = function() {
                $('select[name="Languages"] option').each(function(i, el) {
                    vm.allLocales.add(el.value)
                });
                loadLocalizationSettings();
                loadLocalizationStrings();

                $('#resetLocalization').on('shown.bs.modal', function (e) { root.refreshTabIndices(); });
                $('#resetLocalization').on('hidden.bs.modal', function (e) { root.refreshTabIndices(); });
                $('#importLocalization').on('shown.bs.modal', function (e) { root.refreshTabIndices(); });
                $('#importLocalization').on('hidden.bs.modal', function (e) { root.refreshTabIndices(); });
            };

            /**************************************************************************************************
             * read localization settings
             ***************************************************************************************************/
            function loadLocalizationSettings() {
                root.modal.show();
                $http.get('./localization/settings').then(
                    function(response) {
                        vm.isLocalizationEnabled = response.data.settings.isLocalizationEnabled;
                        vm.languagesObject = response.data.languagesJsonObject;
                        root.modal.hide();
                    },
                    function(httpError) {
                        root.modal.hide();
                        console.error("Error fetching localization settings");
                        console.error(httpError);
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading localization settings. Please try again");
                    }
                );
            }

            /**************************************************************************************************
             * read localization strings
             ***************************************************************************************************/
            function loadLocalizationStrings() {
                root.modal.show();
                return $http.get('./localization/localizedStrings').then(
                    function(response) {
                        vm.latest = JSON.stringify(response);
                        createViewData();
                        vm.activeChanges = 0;
                        if (vm.data[vm.localizationType].locales.indexOf(vm.selectedLocale) < 0) {
                            vm.pickLocale("en-us");
                        }
                        root.modal.hide();
                        root.refreshTabIndices();
                        setTimeout(function () {
                            $('textarea').each(function (index, item) {
                                auto_grow(item)
                            })
                        });
                    },
                    function(httpError) {
                        root.modal.hide();
                        root.toastr.error("Error fetching localization strings");
                        console.error(httpError);
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading localization data. Please try again");
                        root.refreshTabIndices();
                        setTimeout(function () {
                            $('textarea').each(function (index, item) {
                                auto_grow(item)
                            })
                        });
                    }
                );
            }

            function createViewData() {
                const response = JSON.parse(vm.latest);
                const defaultLocalizedStrings = response.data.localizedStrings.defaultLocalizedStrings;
                // settings the system strings list
                {
                    readonlyMap = {};
                    defaultLocalizedStrings.stringIds.forEach(function(stringId) {
                        readonlyMap[stringId] = {};
                        defaultLocalizedStrings.locales.forEach(function(locale) {
                            readonlyMap[stringId][locale] = true;
                        });
                    });
                    const mergedLocalizedStrings = response.data.localizedStrings.mergedLocalizedStrings;
                    vm.data.system.locales = mergedLocalizedStrings.locales;
                    vm.data.system.strings = mergedLocalizedStrings.stringIds
                        .map(function(stringId) {
                            const item = {
                                stringId: {
                                    value: stringId,
                                    original: stringId
                                },
                                state: {saved: true}
                            };
                            vm.data.system.locales.forEach(function(locale) {
                                if (mergedLocalizedStrings[locale]) {
                                    item[locale] = {
                                        value: mergedLocalizedStrings[locale][stringId],
                                        original: mergedLocalizedStrings[locale][stringId],
                                        readonly: readonlyMap[stringId] && readonlyMap[stringId][locale]
                                    };
                                }
                            });
                            return item;
                        }
                    );
                }

                // settings the custom strings list
                {
                    const customLocalizedStrings = response.data.localizedStrings.customLocalizedStrings;
                    vm.data.custom.locales = customLocalizedStrings.locales;
                    vm.data.custom.strings = customLocalizedStrings.stringIds.map(function(stringId) {
                            const item = {
                                stringId: {
                                    value: stringId,
                                    original: stringId
                                },
                                state: {saved: true}
                            };
                            vm.data.custom.locales.forEach(function(locale) {
                                if (customLocalizedStrings[locale]) {
                                    item[locale] = {
                                        value: customLocalizedStrings[locale][stringId],
                                        original: customLocalizedStrings[locale][stringId]
                                    };
                                }
                            });
                            return item;
                        }
                    );
                }
            }

            function removeSpaces(item) {
                if (item.stringId.value.indexOf(" ") >= 0) {
                    item.stringId.value = item.stringId.value.replace(/ /g, "");
                }
            }

            vm.changeListener = function(item) {
                removeSpaces(item);
                const originalChangedState = item.state.changed;
                item.state.changed = false;
                if (item.stringId.value !== item.stringId.original) {
                    item.state.changed = true;
                    return;
                }
                vm.data[vm.localizationType].locales.forEach(function(locale) {
                    if (!item[locale]) {
                        item.state.changed = true;
                    }
                    else if (item[locale].hasOwnProperty("value") && item[locale].hasOwnProperty("original") && item[locale].value !== item[locale].original) {
                        item.state.changed = true;
                    }
                });
                if (!item.state.new && originalChangedState !== item.state.changed) {
                    item.state.changed ? vm.activeChanges++ : vm.activeChanges--;
                }
            };

            vm.search = function() {
                vm.data.custom.strings.forEach(function (item) {
                    item.state.hidden = !show(item.stringId.value);
                });
                vm.data.system.strings.forEach(function (item) {
                    item.state.hidden = !show(item.stringId.value);
                });
                setTimeout(function () {
                    $('textarea').each(function (index, item) {
                        auto_grow(item)
                    })
                });
            };

            vm.clearSearch = function() {
                vm.stringIdSearchRegexp = { value: "" };
                return vm.search();
            };

            function show(stringId) {
                if (vm.stringIdSearchRegexp.value && vm.stringIdSearchRegexp.value.length > 0) {
                    return stringId.match(vm.stringIdSearchRegexp.value || '.*', 'g');
                }
                else {
                    return true;
                }
            }

            $("#fileReaderButton").on('change',function(result){
                root.fileName = result.target.files[0].name;
            });

            vm.pickFilesToImport = function() {
                document.getElementById('fileReaderButton').click();
            };

            vm.dismissImport = function () {
                $("#fileReaderButton").val("");
            };

            vm.addNewString = function (stringId, text) {
                stringId = stringId || "";
                vm.data[vm.localizationType].strings = [{
                    stringId: {
                        value: stringId,
                        original: stringId
                    },
                    state: {
                        new: true
                    },
                    "en-us": {
                        value: text || "",
                        original: text || ""
                    }
                }].concat(vm.data[vm.localizationType].strings);
                vm.activeChanges++;
                root.refreshTabIndices();
                setTimeout(function () {
                    $('textarea').each(function (index, item) {
                        auto_grow(item)
                    });

                    var newStrElement = $('div').find(`[title='${JSON.stringify(vm.data[vm.localizationType].strings[0].stringId)}']`)[0];
                    $(newStrElement).children().focus();
                });
            };

            vm.addNewLocale = function () {
                if (!vm.newLocale) { return;}
                if (!vm.data[vm.localizationType].locales.includes(vm.newLocale)) { // If new local is not already in use
                    vm.data[vm.localizationType].locales.push(vm.newLocale);
                    vm.data[vm.localizationType].strings.forEach(function (item) {
                        item[vm.newLocale] = {
                            value: undefined,
                            original: undefined
                        }
                    });
                    vm.selectedLocale = vm.newLocale;
                    vm.newLocale = "";
                    vm.showLocaleInvalidFormatMsg = false;
                    setTimeout(function () {
                        $('textarea').each(function (index, item) {
                            auto_grow(item)
                        })
                    });
                }
            };

            vm.discard = function () {
                createViewData();
                if (vm.data[vm.localizationType].locales.indexOf(vm.selectedLocale) < 0) {
                    vm.pickLocale("en-us");
                }
                root.refreshTabIndices();
                vm.activeChanges = 0;
                setTimeout(function () {
                    $('textarea').each(function (index, item) {
                        auto_grow(item)
                    })
                });
            };

            vm.undoChanges = function(item) {
                vm.data[vm.localizationType].locales.forEach(function (locale) {
                    if (item[locale]) {
                        item[locale].value = item[locale].original;
                    }
                });
                item.state.changed = false;
                vm.activeChanges--;
                setTimeout(function () {
                    $('textarea').each(function (index, item) {
                        auto_grow(item)
                    })
                });
            };

            vm.removeString = function(index) {
                vm.data[vm.localizationType].strings.splice(index, 1);
                vm.activeChanges--;
                root.refreshTabIndices();
                setTimeout(function () {
                    $('textarea').each(function (index, item) {
                        auto_grow(item)
                    })
                });
            };

            vm.save = function() {
                root.modal.show("Saving");
                {
                    // verify unique ids in each section
                    for (const strings of [vm.data.custom.strings, vm.data.system.strings]) {
                        const stringIds = strings.map(function(item) { return item.stringId.value});
                        const usedIds = new Set();
                        while (stringIds.length > 0) {
                            const stringId = stringIds.pop();
                            if (stringId.trim().length === 0) {
                                root.modal.hide();
                                root.toastr.error('String ID cannot be empty');
                                return;
                            }
                            if (usedIds.has(stringId)) {
                                root.modal.hide();
                                root.toastr.error('String ID "' + stringId + '" already in use.');
                                return;
                            }
                            usedIds.add(stringId);
                        }
                    }
                }

                const custom = vm.data.custom.strings
                    .filter(function (item) { return item.state.new || item.state.changed; })
                    .map(function (item) {
                        const res = {
                            "String ID": item.stringId.value.trim().replace(/ /g, "_")
                        };
                        vm.data.custom.locales.forEach(function (locale) {
                            if (item[locale] && item[locale].value !== undefined) {
                                res[locale] = item[locale].value;
                            }
                        });
                        return res;
                    });
                const defaultStringIds = new Set();
                const system = vm.data.system.strings
                    .filter(function (item) { return item.state.new || item.state.changed; })
                    .map(function (item) {
                        const res = {
                            "String ID": item.stringId.value.trim().replace(/ /g, "_")
                        };
                        if (item.hasOwnProperty("en-us") && item["en-us"].readonly) {
                            defaultStringIds.add(res["String ID"]);
                        }
                        vm.data.system.locales.forEach(function (locale) {
                            if (item[locale] && !item[locale].readonly && item[locale].value !== undefined) {
                                res[locale] = item[locale].value;
                            }
                        });
                        return res;
                    });
                let valid = true;

                custom.forEach(function (item) {
                    if (!item.hasOwnProperty("en-us") || item["en-us"].length === 0) {
                        valid = false;
                    }
                });
                system.forEach(function (item) {
                    if (!defaultStringIds.has(item["String ID"]) && (!item.hasOwnProperty("en-us") || item["en-us"].length === 0)) {
                        valid = false;
                    }
                });
                if (!valid) {
                    root.toastr.error("Strings must have a default value");
                    root.modal.hide();
                    return;
                }
                if (custom.length + system.length === 0) {
                    root.modal.hide();
                    root.toastr.info("No changes made");
                    return;
                }
                var localizedStringsJson = JSON.stringify({custom, system});
                $http.post('./localization/localizedStrings', localizedStringsJson).
                then(function onSuccess(response) {
                    var status = response.status;

                    root.modal.hide();
                    if (status > 299) {
                        root.toastr.error("Sorry, an error occurred while importing localization file. Please try again");
                    } else {
                        vm.init();
                    }
                }, function onError(response) {
                    root.modal.hide();
                    console.error(response);
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Error occurred while trying to save changes. Please try again later.");
                });
            };

            function generateStringId() {
                return "stringId_" + root.md5(new Date().getTime().toString()).substr(0, 16);
            }

            vm.processLocalizationSheet = function(fileContent) {
                if (fileContent.err) {
                    root.modal.hide();
                    return root.toastr.error("Error occurred while trying to process localization file");
                }
                try {
                    vm.showValidFileMsg = false;
                    vm.showInvalidFileWarning = false;
                    vm.importIssues = [];
                    var localizedStrings = fileContent.sheet;
                    localizedStrings.forEach(function (item) { item["String ID"] = item["String ID"].trim().replace(/ /g, "_"); });
                    var currentData = JSON.parse(JSON.stringify(vm.data[vm.localizationType]));
                    var updatedData = localizedStrings.map(function(item) { return {stringId: item["String ID"].trim().replace(/ /g, "_"), ...item, "String ID": undefined}});
                    if (updatedData.length === 0) {
                        vm.importIssues.push({ stringId: undefined, errMsg: "The localization file is empty." });
                        vm.showInvalidFileWarning = true;
                    }
                    else {
                        Object.keys(updatedData[0]).forEach(function (locale) {
                            if (locale !== "stringId" && locale !== "String ID" && !vm.allLocales.has(locale)) {
                                vm.importIssues.push({ stringId: undefined, errMsg: "The locale " + locale + " is not listed as a valid locale on our system. Submit a request to support if this locale is required and should be considered as a valid locale." });
                                vm.showInvalidFileWarning = true;
                            }
                        });
                        if (vm.importIssues.length === 0) {
                            for (let i = 0 ; i < updatedData.length; i++) {
                                const updatedItem = updatedData[i];
                                const stringId = updatedItem.stringId;
                                const existingItem = currentData.strings.find(function(item) { return !item.state.new && item.stringId.original === stringId });
                                if (existingItem) {
                                    currentData.locales.forEach(function (locale) {
                                        if (updatedItem[locale] && existingItem[locale] && existingItem[locale].readonly) {
                                            vm.importIssues.push({ stringId, errMsg: "Editing \"" + locale + "\" for default system strings is forbidden. You can extend the system strings by adding the string in a new language or adding a new string in the same locale." });
                                            vm.showInvalidFileWarning = true;
                                        }
                                    });
                                }
                                else {
                                    if (!updatedItem["en-us"]) {
                                        vm.importIssues.push({ stringId, errMsg: "When adding new strings, a version for en-US must be available." });
                                        vm.showInvalidFileWarning = true;
                                    }

                                }
                            }
                        }
                    }
                    vm.showValidFileMsg = !vm.showInvalidFileWarning;
                    vm.sheetDataToUpload = fileContent.sheet;
                    $scope.$apply();
                } catch (err) {
                    console.error(err.message ? err.message : "Error occurred while trying to process localization file");
                    console.error(err);
                    return root.toastr.error(err.message ? err.message : "Error occurred while trying to process localization file");
                }
            };

            vm.import = function() {
                $('#importLocalization').modal("hide");
                const data = vm.sheetDataToUpload;
                const foundLocales = new Set();
                const currentData = vm.data[vm.localizationType];
                data.forEach(function (item) {
                    const stringId = item["String ID"];
                    delete item["String ID"];
                    const existingItem = currentData.strings.find(function(item) { return !item.state.new && item.stringId.original === stringId });
                    if (existingItem) {
                        if (!existingItem.state.changed) {
                            existingItem.state.changed = true;
                            vm.activeChanges++;
                        }
                        for (const locale of Object.keys(item)) {
                            foundLocales.add(locale);
                            if (existingItem[locale]) {
                                if (!existingItem[locale].readonly) {
                                    existingItem[locale].value = item[locale];
                                }
                            } else {
                                existingItem[locale] = {value: item[locale], original: item[locale]};
                            }
                        }
                    } else {
                        const newStringItem = {stringId: { value: stringId, original: stringId }, state: { new: true }};
                        for (const locale of Object.keys(item)) {
                            foundLocales.add(locale);
                            newStringItem[locale] = {value: item[locale], original: item[locale]}
                        }
                        currentData.strings = [newStringItem].concat(vm.data[vm.localizationType].strings);
                        vm.activeChanges++;
                    }
                });
                foundLocales.forEach(function (locale) {
                    if (currentData.locales.indexOf(locale) < 0) {
                        currentData.locales.push(locale);
                    }
                });

                root.refreshTabIndices();
                setTimeout(function () {
                    $('textarea').each(function (index, item) {
                        auto_grow(item)
                    })
                });
            };

            vm.toggleLocalization = function() {
                root.modal.show(vm.isLocalizationEnabled ? "Turning localization off..." : "Turning localization on...");
                $http.post('./localization/settings', { isLocalizationEnabled: !vm.isLocalizationEnabled }).
                then(function onSuccess(response) {
                    response = response.data;
                    if (response && response.status === "OK") {
                        vm.isLocalizationEnabled = !vm.isLocalizationEnabled;
                        if(vm.isLocalizationEnabled) {
                            root.modal.hide();
                            root.toastr.success("Localization Helper Tool is turned on.");
                        } else {
                            root.modal.hide();
                            return root.toastr.success("Localization Helper Tool is turned off.");
                        }
                    } else {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while changing localization state. Please try again");
                    }
                }, function errorCallback(response) {
                    root.modal.hide();
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while changing localization state. Please try again");
                });
            };

            vm.export = function() {
                var sheetName = (vm.localizationType === "system") ? "System Localization" : "Custom Localization";
                var workbookName = (vm.localizationType === "system") ? "Localization - System strings.xlsx" : "Localization - Custom strings.xlsx";
                var locales = vm.data[vm.localizationType].locales;
                var strings = vm.data[vm.localizationType].strings;
                var localizedStringsToExport = strings.filter(function (item) {
                    return !item.state.new && !item.state.hidden;
                }).map(function (item) {
                    const localizedStringToExport = {
                        "String ID": item.stringId.original
                    };
                    locales.map(function (locale) {
                        localizedStringToExport[locale] = (item[locale] ? item[locale].original : undefined) || "";
                    });
                    return localizedStringToExport;
                });
                var workbook = XLSX.utils.book_new();
                var items = localizedStringsToExport.filter(function(item) { return show(item["String ID"]); });
                var sheet = XLSX.utils.json_to_sheet(items);
                XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
                XLSX.writeFile(workbook, workbookName);
            };
            vm.fetchScenarioStrings = function() {
                $('#resetLocalization').modal('hide');
                root.modal.show("Fetching strings from existing scenarios");
                $http.get('./localization/localizedStrings/from-scenarios').
                then(function onSuccess(response) {
                    response = response.data;
                    if (response && response.status === "OK") {
                        response.localizedStrings.forEach(function (item) {
                            vm.addNewString(item.stringId, item["en_us"])
                        });
                        root.modal.hide();
                    } else {
                        root.modal.hide();
                        root.toastr.error("Sorry, an error occurred while reseting localization data. Please try again");
                    }
                }, function errorCallback(response) {
                    root.modal.hide();
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while resting localization data. Please try again");
                });
            };

            vm.reset = function() {
                $('#resetLocalization').modal('hide');
                root.modal.show("Resetting " + vm.localizationType + " localization...");
                $http.delete('./localization/localizedStrings/' + vm.localizationType).
                then(function onSuccess(response) {
                    response = response.data;
                    if (response && response.status === "OK") {
                        root.modal.hide();
                        vm.init();
                        root.toastr.success("Localization was successfully reset to default");
                    } else {
                        root.modal.hide();
                        root.toastr.error("Sorry, an error occurred while resting localization data. Please try again");
                    }
                }, function errorCallback(response) {
                    root.modal.hide();
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while resting localization data. Please try again");
                });
            };
            vm.showResetModal = function() {
                $('#resetLocalization').modal();
            };
            vm.openImportDrawer = function() {
                vm.tempLocalizedStrings = null;
                vm.localizedStringsFromUploadedFile = null;
                vm.showInvalidFileWarning = false;
                vm.showValidFileMsg = false;
                vm.importFilePath = null;
                vm.importIssues = [];
                $('#importLocalization').modal();
            };
            vm.pickLocale = function(locale) {
                vm.selectedLocale = locale;
                root.refreshTabIndices();
                setTimeout(function () {
                    $('textarea').each(function (index, item) {
                        auto_grow(item)
                    })
                });
            };
            vm.updateSelectedLocalizationType = function(type) {
                vm.localizationType = type;
                vm.selectedLocale = "en-us";
                localStorageService.set("localizationType", type);
                root.refreshTabIndices();
                setTimeout(function () {
                    $('textarea').each(function (index, item) {
                        auto_grow(item)
                    })
                });
            };

        });
})();
