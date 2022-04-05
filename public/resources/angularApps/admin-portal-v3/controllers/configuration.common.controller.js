(function() {
    angular.module('adminPortalApp.controllers')
        .controller('configurationCommonController', function ($rootScope, $window, $scope, $http, $timeout, $moment, localStorageService, $location) {

            var root = $rootScope;
            var vm = this;
            vm.isLocalizationEnabled = false;

            vm.loadingOptions = false;
            vm.localizedStringSearch = function(partOfString, item, field) {
                vm.loadingOptions = true;
                var def = item._scheme._default || item._scheme.default || [];
                if (def === undefined || def === null) {
                    def = [];
                }
                def = Array.isArray(def) ? def : [def];
                if (field) {
                    def = def.map(function(item) { return item[field]});
                }
                return $http.get(location.pathname + "/" +  (location.hash.split('/').pop() || vm.selectedTab) +  '/specificLocalizedStrings?partOfString=' + partOfString).then(
                    function(res) {
                        vm.loadingOptions = false;
                        def = def.concat(res.data.filter(function(item) { return item.stringId !== def[0].stringId}));

                        if (def.filter(function(item) { return item['en-us'] === partOfString;}).length === 0) {
                            def.push({stringId: null, "en-us": partOfString});
                        }
                        return def;
                    },
                    function(httpError) {
                        vm.loadingOptions = false;
                        return def;
                    }
                );
            };

            vm.localizedStringOnBlurHandler = function(field, key, variable) {
                if (typeof(field[key]) === 'string') {
                    field[key] = {
                        "stringId": null,
                        "en-us": field[key]
                    }
                }
                vm.changeHandler(variable || field);
                vm.loadingOptions = false;
            };


            vm.showSysAdminFields = true;
            vm.toggleSysAdminView = function () {
                vm.showSysAdminFields = !vm.showSysAdminFields;
                if (vm.showSysAdminFields) {
                    $('.system-admin-field').removeClass('hidden');
                } else {
                    $('.system-admin-field').addClass('hidden');
                }
            };

            var socket = io($location.protocol() + "://" + $location.host() + ":" + $location.port(), {
                query: "tenantId=" + $('#socketioRoomName').val() + "&" + "user=" + $('#socketioUser').val()
            });
            socket.on('configurationChanged', function(e){
                if ($('#socketioUser').val() !== e.user) {
                    root.toastr.warning("Please refresh the page. The data on this page has been updated by " + e.user, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                }
            });
            root.activeChanges = 0;
            vm.data = {};
            vm.original = {};
            vm.selectedTab = '';
            vm.init = function() {
                vm.loadData();
                $('#resetConfiguration').on('shown.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                $('#resetConfiguration').on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
            };

            vm.initTabsView = function() {
                vm.selectedTab = $location.path().split('/').pop();
                if (!vm.selectedTab || vm.selectedTab.length === 0) {
                    vm.selectedTab = $('.tab-selector')[0].id;
                }
                vm.selectTab(vm.selectedTab);
                $('#resetConfiguration').on('shown.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                $('#resetConfiguration').on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
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
                vm.loadData(function() {  });
                $('.data-container-tab#' + vm.selectedTab).show();
            };

            vm.cancel = function() {
                function recursiveCancelLogic(data) {
                    if (data._tenant !== undefined) {
                        data._tenant = JSON.parse(JSON.stringify(data._original));
                        data._changed = false;
                        return;
                    }
                    for (const key of Object.keys(data)) {
                        recursiveCancelLogic(data[key]);
                    }
                }
                recursiveCancelLogic(vm.data);
                root.activeChanges = 0;
                try {
                    initSliders(vm.data)
                } catch (e) {}

                root.refreshTabIndices();
            };

            vm.loadData = function(cb) {
                root.modal.showProgress('Loading data');
                $http.get(location.pathname + "/" +  vm.selectedTab + "/read").then(
                    function(response) {
                        root.modal.hideProgress();
                        if (response.status === 200) {
                            vm.isLocalizationEnabled = response.data.isLocalizationEnabled;
                            createOriginalValues(response.data.configData);
                            vm.data = response.data.configData;
                            root.activeChanges = 0;
                            try {initSliders(vm.data);} catch (e) {}
                        }
                        else {
                            root.toastr.error("Sorry, there was a problem reading configuration data. Please try to refresh.");
                        }
                        if (cb) {cb(); }
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.modal.hideProgress();
                        root.activeChanges = 0;
                        root.toastr.error("Sorry, there was a problem reading configuration data. Please try to refresh.");
                        if (cb) { cb(); }
                        root.refreshTabIndices();
                    }
                );
            };

            vm.toggleBoolean = function(field) {
                field._tenant = !field._tenant;
                vm.changeHandler(field);
            };

            vm.toggleBooleanArrayItemField = function(field, key, parent) {
                field[key] = !field[key];
                vm.changeHandler(parent);
            };

            vm.selectOption = function(field, option) {
                field._tenant = option;
                vm.changeHandler(field);
            };

            vm.selectRange = function(fmin, fmax, valmin, valmax) {
                fmin._tenant = valmin;
                fmax._tenant = valmax;
                vm.changeHandler(fmin);
                vm.changeHandler(fmax);
            };

            vm.selectionChanged = function(field, type, selectionId) {
                if (field._scheme) {
                    vm.changeHandler(field);
                }

                // in angularjs, "Selected" attributes for <select> options elements not being updated properly
                // this is a patch for that, see https://github.com/angular/angular.js/issues/14419
                if (selectionId) {
                    var options = $('#' + selectionId).find('option');
                    for(const option of options){
                        if (option.label !== field._tenant){
                            $(option).removeAttr('selected');
                        }
                    }
                }
            };

            vm.selectSingleRange = function(id, field) {
                if (field._scheme) {
                    vm.changeHandler(field);
                }
            };


            vm.removeArrayItem = function(field, i) {
                field._tenant.splice(i, 1);
                vm.changeHandler(field);
            };

            vm.addArrayItem = function(field, val, listId) {
                field._tenant.push(val);
                vm.changeHandler(field);
                root.refreshTabIndices();

                if (listId) {
                    setTimeout(function(){
                        var list = $('#' + listId).find("div").find("[role='row']");
                        if (list.length > 0) {
                            var el = $(list[list.length - 1]).find('input');
                            if (el.length > 0){
                                el[0].focus();
                            }
                        }
                    })
                }
            };

            vm.addArrayObject = function(field, definition, tableId) {
                var val = {};
                definition.forEach(function(fieldDefinition) {
                    switch (fieldDefinition[3]) {
                        case "text":
                            val[fieldDefinition[1]] = "";
                            break;
                        case "number":
                            val[fieldDefinition[1]] = 0;
                            break;
                        case "boolean":
                            val[fieldDefinition[1]] = false;
                            break;
                        case "localizedText":
                            val[fieldDefinition[1]] = {"stringId": null, "en-us": ""};
                            break;
                    }
                });
                field._tenant.push(val);
                vm.changeHandler(field);
                root.refreshTabIndices();

                if (tableId) {
                    setTimeout(function(){
                        var table = $('#' + tableId).find("div").find("[role='row']");
                        if (table.length > 0) {
                            var el = $(table[table.length - 1]).find('input');
                            if (el.length > 0){
                                el[0].focus();
                            }
                        }
                    })
                }
            };

            vm.changeHandler = function(field) {
                if (field._scheme.format === "nat") {
                    try {
                        field._tenant = Number(field._tenant);
                    } catch (e) {

                    }
                }
                var original = JSON.stringify(field._original);
                var edited = JSON.stringify(field._tenant);
                if (field._changed && original === edited) {
                    field._changed = false;
                    root.activeChanges--;
                }
                else if (!field._changed && original !== edited) {
                    field._changed = true;
                    root.activeChanges++;
                }
            };

            vm.save = function() {
                if (root.activeChanges === 0) { return; }
                var dataToSave = extTenantValues(vm.data) || {};
                root.modal.showProgress("Saving");
                $http.put(location.pathname + "/" +  vm.selectedTab + "/save", dataToSave).then(
                    function(response) {
                        root.modal.hideProgress();
                        if (response.status === 200) {
                            vm.loadData();
                        }
                        else {
                            root.toastr.error("Sorry, an error occurred while saving configuration. Please try to refresh");
                        }
                    },
                    function(response) {
                        root.modal.hideProgress();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        if (response.status === 422) { return root.toastr.error(response.data); }
                        root.toastr.error("Sorry, an error occurred while saving configuration. Please try to refresh");
                    }
                );
            };

            vm.reset = function() {
                $('#resetConfiguration').modal()
            };

            vm.executeReset = function() {
                root.modal.showProgress("Back to default");
                $http.put(location.pathname + "/" +  vm.selectedTab + "/reset").then(
                    function(response) {
                        root.modal.hideProgress();
                        if (response.status === 200) {
                            vm.loadData();
                        }
                        else {
                            root.toastr.error("Sorry, an error occurred while resetting configuration. Please try to refresh");
                        }
                    },
                    function(response) {
                        root.modal.hideProgress();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while resetting configuration. Please try to refresh");
                    }
                );
            };

            function extTenantValues(data) {
                if (data._tenant !== undefined) {
                    return (data._changed === true || data._default === false) ? data._tenant : undefined;
                }
                var result = {};
                for (const key of Object.keys(data)) {
                    if (data[key].key) {
                        result[data[key].key] = extTenantValues(data[key])
                    } else {
                        result[key] = extTenantValues(data[key]);
                    }
                }
                return Object.keys(result).length === 0 ? undefined : result;
            }

            function createOriginalValues(data) {
                if (data._tenant !== undefined) {
                    data._original = JSON.parse(JSON.stringify(data._tenant));
                    data._changed = false;
                    return;
                }
                for (const key of Object.keys(data)) {
                    createOriginalValues(data[key]);
                }
                return;
            }

            vm.localizedStrings = [];
            vm.refreshStrings = function(partOfString, item) {
                var def = item._scheme._default || item._scheme.default || [];
                if (def === undefined || def === null) {
                    def = [];
                }
                def = Array.isArray(def) ? def : [def];
                $http.get(location.pathname + "/" +  location.hash.split('/').pop() +  '/specificLocalizedStrings?partOfString=' + partOfString).then(
                    function(res) {
                        vm.localizedStrings = def.concat(res.data);
                    },
                    function(httpError) {
                        console.error(httpError);
                    }
                );
            };

            vm.readLocalizedStrings = function(partOfString, item, cb) {
                var def = item._scheme._default || item._scheme.default || [];
                if (def === undefined || def === null) {
                    def = [];
                }
                def = Array.isArray(def) ? def : [def];
                $http.get(location.pathname + "/" +  location.hash.split('/').pop() +  '/specificLocalizedStrings?partOfString=' + partOfString).then(
                    function(res) {
                        return cb(def.concat(res.data.filter(function(item) { return item.stringId !== def[0].stringId})));
                    },
                    function(httpError) {
                        return cb(def);
                    }
                );
            };

        });
})();
