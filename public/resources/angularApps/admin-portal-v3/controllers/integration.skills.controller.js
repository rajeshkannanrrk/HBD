(function() {
    angular.module('adminPortalApp.controllers')
        .controller('skillsCtrl', function ($rootScope, $window, $scope, $http, $timeout, $moment, localStorageService, $location) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;
            vm.monitoredData = {name:{}, description:{}, publisherName:{}, isExposed: {}, isPublic:{}, authorizedAppIds:{}};
            vm.manifestUrl = "";
            vm.appId = "";
            vm.selectedTab = "";
            vm.newSkill = {validation: {manifestUrl:""}, data: {manifestUrl:"", name:"", description:"", publisherName: "", endpointUrl:"", msAppId:""}};
            vm.skills = [];

            vm.deleteRegisteredSkill = function (skill) {
                root.modal.show("Deleting skill");
                return $http.delete('./skills/consume/registeredSkill?manifestUrl=' + encodeURIComponent(skill.manifestUrl)).then(
                    function(response) {
                        if (response.status === 200) {
                            root.toastr.success('Skill was successfully refreshed.');
                        }
                        root.modal.hide();
                        root.refreshTabIndices();
                        vm.readSkillsConfiguration();
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while refreshing skill. Please try again");
                        root.refreshTabIndices();
                    }
                );
            }
            
            vm.RefreshRegisteredSkill = function (skill) {
                root.modal.show("Refreshing skill");
                return $http.put('./skills/consume/registeredSkill', {manifestUrl: skill.manifestUrl}).then(
                    function(response) {
                        if (response.status === 200) {
                            root.toastr.success('Skill was successfully refreshed.');
                        }
                        root.modal.hide();
                        root.refreshTabIndices();
                        vm.readSkillsConfiguration();
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while refreshing skill. Please try again");
                        root.refreshTabIndices();
                    }
                );
            }
            
            vm.fetchSkillManifest = function () {
                return $http.get('./skills/consume/fetchManifest?manifestUrl=' + encodeURIComponent(vm.newSkill.data.manifestUrl)).then(
                    function(response) {
                        if (response.status === 200) {
                            vm.newSkill.data.name = response.data.name;
                            vm.newSkill.data.description = response.data.description;
                            vm.newSkill.data.publisherName = response.data.publisherName;
                            vm.newSkill.data.endpointUrl = response.data.endpointUrl;
                            vm.newSkill.data.msAppId = response.data.msAppId;
                        }
                        root.modal.hide();
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while fetching skill manifest. Please try again");
                        root.refreshTabIndices();
                    }
                );
            }
            
            vm.addFetchedSkill = function () {
                const manifestUrls = vm.skills.map(skillInfo => skillInfo.manifestUrl);
                if (manifestUrls.includes(vm.newSkill.data.manifestUrl)) {
                    root.toastr.error("Skill already registered.");
                    return;
                }
                if (!vm.newSkill.data.name || !vm.newSkill.data.endpointUrl || !vm.newSkill.data.msAppId) {
                    root.toastr.error(`Missing skill attributes. Manifest URL must include name, endpointURL and msAppId, and must be fetched before registering.`);
                    return;
                }
                root.modal.show("Adding skill");
                return $http.post('./skills/consume/newSkill', vm.newSkill.data).then(
                    function(response) {
                        if (response.status === 200) {
                            root.toastr.success('A new skill was successfully saved.');
                        }
                        root.modal.hide();
                        root.refreshTabIndices();
                        vm.readSkillsConfiguration();
                        root.closeDrawer("newSkillDrawer");
                        vm.newSkill = {validation: {manifestUrl:""}, data: {manifestUrl:"", name:"", description:"", publisherName: "", endpointUrl:"", msAppId:""}};
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while saving skill. Please try again");
                        root.refreshTabIndices();
                    }
                );
            }

            vm.readSkillsConfiguration = function () {
                root.modal.show("Loading");
                if (vm.selectedTab === "expose") {
                    vm.readSkillExposureConfiguration();
                }
                else if (vm.selectedTab === "consume") {
                    vm.readSkillConsumerConfiguration();
                }
            };
            
            vm.organizeReceivedDataInObjects = function(data) {
                vm.monitoredData.name = {_tenant: data.name, _original: data.name, _changed: false};
                vm.monitoredData.description = {_tenant: data.description, _original: data.description, _changed: false};
                vm.monitoredData.publisherName = {_tenant: data.publisherName, _original: data.publisherName, _changed: false};
                vm.monitoredData.isExposed = {_tenant: data.isExposed, _original: data.isExposed, _changed: false};
                vm.monitoredData.authorizedAppIds = {_tenant: JSON.parse(JSON.stringify(data.authorizedAppIds)), _original: JSON.parse(JSON.stringify(data.authorizedAppIds)), _changed: false};
                vm.monitoredData.isPublic = {_tenant: !data.isRestricted, _original: !data.isRestricted, _changed: false};
                vm.manifestUrl = data.manifestUrl;
            };

            vm.cancelChanges = function() {
                for (const dataItemName of Object.keys(vm.monitoredData)) {
                    vm.monitoredData[dataItemName]._tenant = JSON.parse(JSON.stringify(vm.monitoredData[dataItemName]._original));
                    vm.monitoredData[dataItemName]._changed = false;
                }
                root.activeChanges = 0;
            };
            
            vm.readSkillConsumerConfiguration = function () {
                return $http.get('./skills/consume/config').then(
                    function(response) {
                        if (response.status === 200) {
                            vm.skills = response.data.skills;
                            vm.appId = response.data.appId;
                        }
                        root.modal.hide();
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading skills consumer configuration. Please try again");
                        root.refreshTabIndices();
                    }
                );
            }

            vm.readSkillExposureConfiguration = function () {
                return $http.get('./skills/expose/config').then(
                    function(response) {
                        if (response.status === 200) {
                            vm.organizeReceivedDataInObjects(response.data);
                            root.activeChanges = 0;
                        }
                        return $http.get('./skills/expose/manifest').then(
                            function(response) {
                                if (response.status === 200) {
                                    vm.manifestUrl = response.data;
                                }
                                root.modal.hide();
                                root.refreshTabIndices();
                            },
                            function(response) {
                                root.modal.hide();
                                if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                                root.toastr.error("Sorry, an error occurred while reading skill manifest url. Please try again");
                                root.refreshTabIndices();
                            });
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading skill exposure configuration. Please try again");
                        root.refreshTabIndices();
                    }
                );
            }

            vm.toggleBoolean = function(field) {
                field._tenant = !field._tenant;
                vm.changeHandler(field);
            };

            vm.addArrayObject = function(field, definition) {
                const val = {};
                definition.forEach(function(fieldDefinition) {
                    val[fieldDefinition[1]] = "";
                });
                field._tenant.push(val);
                vm.changeHandler(field);
            };

            vm.changeHandler = function(field) {
                const original = JSON.stringify(field._original);
                const edited = JSON.stringify(field._tenant);
                if (field._changed && original === edited) {
                    field._changed = false;
                    root.activeChanges--;
                }
                else if (!field._changed && original !== edited) {
                    field._changed = true;
                    root.activeChanges++;
                }
            };

            vm.removeArrayItem = function(field, i) {
                field._tenant.splice(i, 1);
                vm.changeHandler(field);
            };
            
            vm.save = function() {
                if (vm.selectedTab === "expose") {
                    vm.saveSkillExposureConfig();
                }
            }

            vm.openNewSkillForm = function () {
                root.openDrawer("newSkillDrawer");
            };

            vm.saveSkillExposureConfig = function() {
                root.modal.show("Saving");
                // Validate Skill Properties
                let missingProperties = false;
                if (!vm.monitoredData.publisherName._tenant) {
                    root.toastr.error("Publisher Name must have a value");
                    missingProperties = true;
                }
                if (!vm.monitoredData.name._tenant) {
                    root.toastr.error("Name must have a value");
                    missingProperties = true;
                }
                if (missingProperties) {
                    root.modal.hide();
                    return;
                }
                // Validate app ids
                const appIDPattern = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');
                const allAppIds = [];
                for (const entry of vm.monitoredData.authorizedAppIds._tenant) {
                    allAppIds.push(entry.appId);
                }
                const invalids = [];
                for (const appId of allAppIds) {
                    if (!appId) {
                        toastr.error('Empty bot id');
                        root.modal.hide();
                        return;
                    }
                    else if (!appIDPattern.test(appId)) {
                        invalids.push(appId);
                    }
                }
                if (invalids.length > 0) {
                    toastr.error(`Invalid App IDs: ${invalids.join(', ')}`);
                    root.modal.hide();
                    return;
                }
                const repeatsCounter = {};
                allAppIds.forEach(function(x) {
                    repeatsCounter[x] = (repeatsCounter[x] || 0) + 1;
                });
                const duplicates = Object.keys(repeatsCounter).filter(key => repeatsCounter[key] > 1);
                if(duplicates.length > 0) {
                    toastr.error(`Duplicate App IDs: ${duplicates.join(', ')}`);
                    root.modal.hide();
                    return;
                }
                $http.post('./skills/expose/config', {name: vm.monitoredData.name._tenant, description: vm.monitoredData.description._tenant, publisherName: vm.monitoredData.publisherName._tenant,
                    isExposed: vm.monitoredData.isExposed._tenant, isRestricted: !vm.monitoredData.isPublic._tenant, authorizedAppIds: vm.monitoredData.authorizedAppIds._tenant}).then(function(response) {
                    toastr.clear();
                    root.modal.hide();
                    if (response.status === 200) {
                        for (const dataItemName of Object.keys(vm.monitoredData)) {
                            if (typeof vm.monitoredData[dataItemName]._original === 'object') {
                                vm.monitoredData[dataItemName]._original = JSON.parse(JSON.stringify(vm.monitoredData[dataItemName]._tenant));
                            }
                            else {
                                vm.monitoredData[dataItemName]._original = vm.monitoredData[dataItemName]._tenant;
                            }
                            vm.changeHandler(vm.monitoredData[dataItemName]);
                        }
                        root.toastr.success('Successfully saved Skills configuration.');
                    }
                    else {
                        root.toastr.error("Sorry, an error occurred while saving skills configuration. Please try again");
                        root.modal.hide();
                    }
                }, function(response) {
                    root.modal.hide();
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while saving skills configuration. Please try again");
                });
            };

            vm.reset = function() {
                root.modal.show("Resetting skills " + vm.selectedTab + " configuration...");
                $http.put('./skills/' + vm.selectedTab + '/reset').then(function(response) {
                    toastr.clear();
                    root.modal.hide();
                    if (response.status === 200) {
                        root.toastr.success('Skills configuration was successfully reset to default.');
                    }
                    else {
                        root.toastr.error("Sorry, an error occurred while resetting skills configuration. Please try again");
                    }
                    vm.readSkillsConfiguration();
                }, function(response) {
                    root.modal.hide();
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("Sorry, an error occurred while resetting skills configuration. Please try again");
                });
            };

            vm.showResetModal = function() {
                $('#resetSkills').modal();
            };

            vm.ShowSkillExposureWarning = function() {
                if (vm.monitoredData.isExposed._tenant) {
                    $('#warningSkills').modal();
                }
            };
            
            vm.closeNewSkillForm = function() {
                root.closeDrawer("newSkillDrawer");
            }

            vm.initTabsView = function() {
                vm.selectedTab = $location.path().split('/').pop();
                if (!vm.selectedTab || vm.selectedTab.length === 0) {
                    vm.selectedTab = $('.tab-selector')[0].id;
                }
                vm.selectTab(vm.selectedTab);
            };

            vm.selectTab = function(id) {
                if ($('.tab-selector#' + id).hasClass("active")) {
                    return;
                }
                $('.data-container').scrollTop(0);
                vm.selectedTab = id;
                $('.tab-selector').removeClass("active");
                $('.tab-selector#' + vm.selectedTab).addClass("active");
                $('.data-container-tab').hide();
                $location.url(vm.selectedTab);
                $location.replace();
                $window.history.pushState(null, 'any', $location.absUrl());
                vm.readSkillsConfiguration();
                $('.data-container-tab#' + vm.selectedTab).show();
            };
        });
})();
