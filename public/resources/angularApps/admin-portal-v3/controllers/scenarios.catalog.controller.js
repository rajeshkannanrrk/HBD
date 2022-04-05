(function() {
    angular.module('adminPortalApp.controllers')
        .controller('scenariosCatalogCtrl', function ($rootScope, $window, $scope, $http, $timeout, $moment, localStorageService, $location) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;
            vm.chosenTemplate = null;
            vm.categoryItemsDisplayOrderCounter = {};

            /**************************************************************************************************
             * loading data on controller init event
             ***************************************************************************************************/
            vm.proceedToScenario = function(){
                root.modal.show();
                var splitUrl = location.href.split("/");
                splitUrl[splitUrl.length - 2] = "scenario-editor";
                splitUrl [splitUrl.length - 1] = vm.chosenTemplate.scenarioUrl;
                location.href = splitUrl.join("/");
            };

            vm.import = function(action, entity) {
                if (action === 'begin') {
                    vm.validation = {};
                    vm.chosenTemplate = entity;
                    vm.customFields = entity.CustomFields;
                    evaluateCustomFields(vm.customFields);
                    vm.chosenTemplate.MoreInformationBullets = vm.chosenTemplate.MoreInformation.split("\\n").filter(function(t) { return t.length > 0});
                    vm.success = null;
                    root.openDrawer("catalogImportDrawer");
                }
                else if (action === 'cancel') {
                    root.closeDrawer("catalogImportDrawer");
                    vm.chosenTemplate = null;
                    vm.customFields = null;
                }
                else if (action === 'import') {
                    for (var field of vm.customFields) {
                        vm.validation[field.name] = !field.value ? `${field.name} is required` : null;
                    }

                    for (var validationField of Object.keys(vm.validation)) {
                        if (vm.validation[validationField]) {
                            return;
                        }
                    }

                    root.modal.showGlobal('Importing');
                    $http({
                        method: 'POST',
                        url: './catalog/importFromCatalog',
                        params: {
                            templateId: vm.chosenTemplate.RowKey,
                            catalogId: vm.chosenTemplate.PartitionKey,
                            customFields: JSON.stringify(vm.customFields),
                        }
                    }).then(
                        function(response) {
                            root.modal.hideGlobal();
                            if (response.status === 200) {
                                vm.success = true;
                                root.toastr.success("Import completed successfully");
                                vm.chosenTemplate.scenarioUrl = response.data;
                                vm.proceedToScenario();
                            }
                            else {
                                root.toastr.error('Unexpected error - Please try again');
                            }
                        },
                        function(httpError) {
                            root.modal.hideGlobal();
                            if(httpError.status === 400) {
                                if (typeof(httpError.data) === 'string'){
                                    root.toastr.error(httpError.data);
                                }
                                else if (Array.isArray(httpError.data)) {
                                    httpError.data.forEach(function (field) {
                                        if (field == 'name') {
                                            vm.validation.name = "Scenario name " + vm.newScenario.name + " already exists. Please choose a different name.";
                                        }
                                    });
                                }
                            }
                            else{
                                if (httpError.status === 403) { return root.toastr.error(httpError.status + ' ' + httpError.statusText + ": " + httpError.data); }
                                else {
                                    root.toastr.error('Unexpected error - Please try again');
                                }
                            }
                        }
                    );
                }
            };

            vm.init = function() {
                root.modal.show();
                $http.get('./catalog/templates').then(
                    function(response) {
                        root.modal.hide();
                        if (response.status !== 200) {
                            root.toastr.error('Unexpected error - Please try again');
                        }
                        else {
                            var itemOrderCounter = {};
                            vm.catalogEntities = response.data;
                            angular.forEach(response.data, function(template) {
                                template.Category = template.Category || 'Popular Templates';
                                template.show = false;
                                template.available = false;
                                if (template.Status !== "Disabled") {
                                    template.show = true;
                                    itemOrderCounter[template.Category] = itemOrderCounter[template.Category] || 1;
                                    template.itemOrder = itemOrderCounter[template.Category];
                                    itemOrderCounter[template.Category]++;
                                }
                                if (template.Status === "Enabled") {
                                    template.available = true;
                                }
                            });
                            vm.templatesCategories = getTemplatesCategories();
                            $('#catalogPage').removeClass("d-none");
                        }
                        root.refreshTabIndices();
                    },
                    function(httpError) {
                        root.modal.hide();
                        root.toastr.error('Unexpected error - Please try again');
                    }
                );
            };

            function getTemplatesCategories() {
                return [...new Set(vm.catalogEntities.filter(template => template && template.Status === "Enabled").map((template) => template.Category))]
            }

            function evaluateCustomFields(customFields) {
                for (var field of customFields) {
                    if (field.dropdownOptions) {
                        field.dropdownOptions = eval(field.dropdownOptions);
                        field.value = field.dropdownOptions[0].value;
                    }
                }
            }
        });
})();
