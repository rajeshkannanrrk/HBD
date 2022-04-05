(function() {
    angular.module('adminPortalApp.controllers')
        .controller('scenariosCatalogEditorCtrl', function ($rootScope, $window, $scope, $http, $timeout, $moment, localStorageService, $location) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;
            vm.templates = null;
            vm.templatesCategories = null;
            var ENABLED_STATUS = 'Enabled';
            var DISABLED_STATUS = 'Disabled';
            vm.statusOptions = [ENABLED_STATUS, 'Coming-soon', DISABLED_STATUS];
            vm.customFieldsInputTypes = ['Text', 'Dropdown'];

            vm.init = () => {
                vm.refreshTemplates();
            };

            vm.refreshTemplates = () => {
                root.modal.show();
                $http.get('./catalog/templates').then(
                    (response) => {
                        root.modal.hide();
                        if (response.status !== 200) {
                            root.toastr.error('Unexpected error - Please try again');
                        }
                        else {
                            vm.templates = response.data;
                            response.data.forEach(function(template) {
                                template.TimestampMoment = $moment(template.Timestamp).from();
                                template.PublishedMoment = template.PublishedAt || "N/A";
                            });
                            vm.templatesCategories = getTemplatesCategories();
                        }
                        root.refreshTabIndices();
                    }, () => {
                        root.modal.hide();
                        root.toastr.error('Unexpected error - Please try again');
                        root.refreshTabIndices();
                    }
                );
            };

            function getTemplatesCategories() {
                return vm.templates.map((template) => template.Category || 'Popular Templates').filter((v, i, a) => v !== undefined && a.indexOf(v) === i);
            }

            vm.editTemplateDetails = function(action, entity) {
                if (action === 'begin') {
                    vm.validation = {
                        name: null,
                        description: null,
                        more_information: null,
                    };
                    if (entity != null) {
                        vm.isNew = false;
                        vm.currentTemplate = {
                            pk: entity.PartitionKey,
                            rk: entity.RowKey,
                            name: entity.Name,
                            category: entity.Category,
                            publishedAt: entity.PublishedAt,
                            description: entity.Description,
                            more_information: entity.MoreInformation || "",
                            extra_data: entity.ExtraData,
                            custom_fields: entity.CustomFields,
                            new: entity.New || false,
                            usingSourceImage: entity.UsingSourceImage || false,
                            status: entity.Status,
                        };
                    } else {
                        vm.isNew = true;
                        vm.currentTemplate = {
                            pk: "builtincatalog",
                            name: "",
                            category: "",
                            publishedAt: "",
                            description: "",
                            more_information: "",
                            extra_data: "",
                            custom_fields: [],
                            new: true,
                            usingSourceImage: false,
                            status: DISABLED_STATUS,
                        };
                    }
                    $('#iconToUpload')[0].value = "";
                    $('#upload-icon').html('');
                    $('#infoImgToUpload')[0].value = "";
                    $('#upload-infoImg').html('');
                    $('#sourceImgToUpload')[0].value = "";
                    $('#upload-source-img').html('');
                    $('#templateToUpload')[0].value = "";
                    $('#upload-template').html('');
                    root.openDrawer("editTemplateDrawer");
                }
                else if (action == 'cancel') {
                    root.closeDrawer("editTemplateDrawer");
                }
                else if (action == 'save') {
                    var icon = $('#iconToUpload')[0].files[0]; // todo: limit size? type? null?
                    var gif = $('#infoImgToUpload')[0].files[0]; // todo: limit size? type? null?
                    var sourceImg = $('#sourceImgToUpload')[0].files[0];
                    var templateContent = $('#templateToUpload')[0].files[0];
                    vm.validation = {
                        name: vm.currentTemplate.name.trim().length > 0 ? null : "Name must be defined",
                        description: vm.currentTemplate.description.trim().length > 0 ? null : "Description must be defined"
                    };
                    if (vm.isNew) {
                        vm.validation.icon = icon ? null : "Icon must be provided for template";
                        vm.validation.gif = gif ? null : "Gif must be provided for template";
                        vm.validation.template = templateContent == null && vm.currentTemplate.status === ENABLED_STATUS ? "File must be provided for enabled templates" : null;
                    }
                    if (vm.validation.name || vm.validation.description || vm.validation.more_information ||
                        vm.validation.icon || vm.validation.gif || vm.validation.template) {
                        return;
                    }
                    var form = new FormData();
                    form.append("icon", icon);
                    form.append("infoImg", gif);
                    form.append("sourceImg", sourceImg);
                    form.append("templateContent", templateContent);
                    form.append("templateToEdit", JSON.stringify(vm.currentTemplate));
                    root.modal.showGlobal(vm.isNew ? 'Creating' : 'Updating');
                    $http({
                        method: 'POST',
                        url: './catalogEditor/editOrAddTemplate',
                        data: form,
                        headers: { 'Content-Type': undefined},
                        transformRequest: angular.identity
                    }).then((response) => {
                        root.modal.hideGlobal();
                        if (response.status === 200) {
                            root.closeDrawer("editTemplateDrawer");
                            vm.init();
                            root.toastr.success(vm.isNew ? "Template was successfully created" :"Template was successfully edited");
                        }
                        else {
                            root.toastr.error('Unexpected error - Please try again');
                        }    
                
                        },
                        vm.serverErrorFunction
                    );
                }
            };
            
            vm.serverErrorFunction = (httpError) => {
                root.modal.hideGlobal();
                if(httpError.status === 400) {
                    // special case for name
                    if (httpError.data.includes('NAME_ALREADY_EXISTS')) {
                        vm.validation.name = "Template with name " + vm.currentTemplate.name + " already exists. Please choose a different name";
                    } else if (httpError.data.includes("STATUS_TEMPLATE_FILE_INCONSISTENCY")) {
                        vm.validation.status = "Enabled template must include a template file";
                    }
                } else {
                    if (httpError.status === 403) {
                        return root.toastr.error(httpError.status + ' ' + httpError.statusText + ": " + httpError.data);
                    } else {
                        root.toastr.error('Unexpected error - Please try again');
                    }
                }
            };
            
            vm.addCustomField = function (customFields) {
                customFields.push({
                    name: '',
                    description: '',
                    inputType: 'Text',
                });
            };

            vm.removeCustomField = function (customFields, field) {
                var index = customFields.indexOf(field);
                if (index > -1) {
                    customFields.splice(index, 1);
                }
            };
        });
})();
