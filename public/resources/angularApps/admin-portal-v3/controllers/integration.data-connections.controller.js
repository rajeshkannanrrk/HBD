(function() {
    angular.module('adminPortalApp.controllers')
        .controller('dataConnectionsCtrl', function ($rootScope, $scope, $http, $timeout, $window) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;
            vm.drawer_edit_mode = false;
            vm.current = {};
            vm.drawer_title = "New Data connection";
            vm.auth_providers = [];
            vm.items = [];
            vm.staticParamsCount = 0;

            function resetValidation() {
                vm.validation = {
                    name: null,
                    base_url: null,
                    static_parameters: null
                };
                resetFetchingState();
            }

            function resetFetchingState() {
                vm.fetching = false;
                vm.fetched = false;
                vm.fetchError = null;
            }

            vm.fetchFhirCapabilities = function() {
                resetFetchingState();
                root.toastr.info("Fetching FHIR server capabilities...");
                vm.fetching = true;
                $.getJSON({
                    method: 'GET',
                    url: vm.current.base_url + '/metadata?_format=json'
                }).then(
                    function(response){
                        vm.fetching = false;
                        vm.fetched = true;
                        if (response.resourceType === "CapabilityStatement") {
                            var resources = response.rest[0].resource;
                            vm.fetchedResources = [];
                            resources.forEach(function(item) {
                                vm.fetchedResources.push({
                                    name: item.type,
                                    methods: item.interaction ? item.interaction.map(function(item) { return item.code; }).join(", ") : ""
                                });
                            });
                        }
                        $scope.$apply();
                        $(document).ready(function(){
                            $('[data-toggle="tooltip"]').tooltip();
                        });
                    },
                    function(httpError) {
                        vm.fetched = true;
                        vm.fetching = false;
                        vm.fetchError = "Fetch capabilities operation failed.";
                        $scope.$apply();
                    }
                );
            };

            vm.init = function() {
                vm.readData();
                $('#deleteItem').on('shown.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                $('#deleteItem').on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
            };

            vm.readData = function(cb) {
                root.modal.show();
                $http.get('./data-connections/read').then(
                    function(response) {
                        if (response.status === 200) {
                            vm.items = response.data;
                            root.modal.hide();
                            root.refreshTabIndices();
                        } else {
                            root.toastr.error("Sorry, an error occurred while reading data connections. Please try again");
                        }

                    },
                    function(response) {
                        root.modal.hide();
                        root.refreshTabIndices();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading data connections. Please try again");
                    }
                );
            };

            vm.showAddNewItemDrawer = function() {
                resetValidation();
                vm.drawer_title = "New Data connection";
                vm.drawer_edit_mode = false;
                vm.current = {
                    name: "",
                    description: "",
                    isFhir: false,
                    base_url: "",
                    auth_provider: "",
                    static_parameters: []
                };
                showDrawer();
            };

            function showDrawer() {
                resetValidation();
                root.modal.show();
                $http.get('./authentication/read').then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            vm.auth_providers = response.data.map(auth => {
                                auth.type_text = auth.type === "server2server" ? "(Server 2 Server)" : "(OAuth 2.0)";
                                return auth;
                            });
                            root.openDrawer("dataConnectionDrawer");
                        } else {
                            root.toastr.error("Sorry, an error occurred while listing authentication providers. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while listing authentication providers. Please try again");
                    }
                );

            }

            vm.showEditItemDrawer = function(item) {
                vm.drawer_title = "Edit Data connection";
                vm.drawer_edit_mode = true;
                vm.current.id = item.id || "";
                vm.current.name = item.name || "";
                vm.current.description = item.description || "";
                vm.current.base_url = item.base_url || "";
                vm.current.auth_provider = item.auth_provider || "";
                vm.current.isFhir = (item.type) ? (item.type === "fhir_3") : false;
                if (item.static_parameters) {
                    vm.current.static_parameters = JSON.parse(item.static_parameters);
                    vm.current.static_parameters.forEach(function(header) {
                        header.valid = header.key.length > 0 && header.value.length > 0;
                        if (!header.hasOwnProperty('type')) {
                            header.type = 'header'
                        }
                    })
                } else {
                    vm.current.static_parameters = [];
                }
                showDrawer();
            };

            vm.cancelAddAndEdit = function() {
                root.closeDrawer("dataConnectionDrawer");
            };

            vm.updateStaticHeader = function(item) {
                item.valid = item.key.length > 0 & item.value.length > 0;
            };

            vm.addStaticParam = function() {
                vm.current.static_parameters.push({
                    key: "",
                    type: "header",
                    value: "",
                    valid: false
                });
                root.refreshTabIndices(true);
                setTimeout(function(){
                    $('#dc-type_' + vm.staticParamsCount).trigger("focus");
                    vm.staticParamsCount++;
                });
            };

            vm.removeStaticParam = function(index) {
                var newList = [];
                vm.current.static_parameters.forEach(function (item, i) {
                    if (i !== index) {
                        newList.push(item);
                    }
                });
                vm.current.static_parameters = newList;
                vm.staticParamsCount--;
                $('#dc-add-new-item').trigger("focus");
            };

            vm.validateForm = function() {
                var errFieldId  = null;
                resetValidation();
                if (vm.current.name.length === 0 || (vm.items.filter(function(item) {
                    return (item.id !== vm.current.id) && (item.name.toLowerCase() === vm.current.name.toLowerCase())
                }).length > 0)) {
                    vm.validation.name = "A unique name is required for identifying this data connection";
                    errFieldId = errFieldId || '#dc-name';
                }
                if (vm.current.base_url.length === 0 || (vm.current.base_url.indexOf('https') < 0)) {
                    vm.validation.base_url = "A valid URL is required to create a new connection.";
                    errFieldId = errFieldId || '#dc-base_url';
                }

                vm.current.static_parameters.forEach(function(item, i) {
                    if (item.key.length === 0 || item.value.length === 0) {
                        vm.validation.static_parameters = "Static parameters should be provided in full or removed from the connection";
                        errFieldId = errFieldId || ('#dc-' + (item.key.length === 0 ? 'key_' : 'value_') + i);
                        console.log(errFieldId);
                    }
                });

                if (!errFieldId) {
                    saveItem();
                } else {
                    $(errFieldId).trigger("focus");
                }
            };

            function saveItem() {
                vm.current.static_parameters.forEach(function (item) { delete item.valid;});
                vm.current.type = vm.current.isFhir ? "fhir_3" : "custom";
                var dataToSend = JSON.parse(JSON.stringify(vm.current));
                delete dataToSend.isFhir;
                var requestOptions = {
                    method: vm.drawer_edit_mode ? 'PUT' : 'POST',
                    url: './data-connections' + (vm.drawer_edit_mode ? '/' + dataToSend.id : '/'),
                    data: dataToSend
                };
                root.modal.show("Saving data connection");
                $http(requestOptions).then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success("Data connection saved");
                            root.closeDrawer("dataConnectionDrawer");
                            vm.readData();
                        } else {
                            root.toastr.error("Sorry, an error occurred while saving data connection. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while saving data connection. Please try again");
                    }
                );
            }

            vm.itemToDelete = null;
            vm.deleteItem = function () {
                root.modal.show("Deleting data connection");
                $http.delete('./data-connections/' + vm.itemToDelete.id).then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success("Data connection deleted");
                            vm.readData();
                        }
                        else {
                            root.toastr.error("Sorry, an error occurred while deleting data connection. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while deleting data connection. Please try again");
                    }
                );
            };

            vm.toggleisFhir = function(item) {
                item.isFhir = !item.isFhir;
                root.refreshTabIndices(true);
            }
        });
})();
