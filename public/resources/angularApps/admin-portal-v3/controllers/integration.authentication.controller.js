(function() {
    angular.module('adminPortalApp.controllers')
        .controller('authProvidersCtrl', function ($rootScope, $scope, $http, $timeout, $window) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;
            vm.drawer_edit_mode = false;
            vm.current = {};
            vm.drawer_title = "New Authentication provider";
            vm.validation = {
                name: false,
                oauth2_client_id: false,
                oauth2_client_secret: false,
                oauth2_authorization_url: false,
                oauth2_access_token_url: false,
                oauth2_scope: false
            };

            vm.items = [];

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
                $http.get('./authentication/read').then(
                    function(response) {
                        vm.items = response.data;
                        root.modal.hide();
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.toastr.error("Sorry, an error occurred while reading authentication providers. Please try again");
                        root.modal.hide();
                        root.refreshTabIndices();
                    }
                );
            };

            vm.showAddNewItemDrawer = function() {
                resetValidation();
                vm.drawer_title = "New Authentication provider";
                vm.drawer_edit_mode = false;
                vm.current = {
                    name: "",
                    description: "",
                    type: "oauth2",
                    oauth2_client_id: "",
                    oauth2_client_secret: "",
                    oauth2_authorization_url: "",
                    oauth2_access_token_url: "",
                    oauth2_scope: ""
                };
                showDrawer();
            };

            vm.showEditItemDrawer = function(item) {
                resetValidation();
                vm.drawer_title = "Edit Authentication provider";
                vm.drawer_edit_mode = true;
                vm.current.id = item.id || "";
                vm.current.name = item.name || "";
                vm.current.description = item.description || "";
                vm.current.type = item.type || "oauth2";
                vm.current.oauth2_client_id = item.oauth2_client_id || "";
                vm.current.oauth2_client_secret = item.oauth2_client_secret || "";
                vm.current.oauth2_authorization_url = item.oauth2_authorization_url || "";
                vm.current.oauth2_access_token_url = item.oauth2_access_token_url || "";
                vm.current.oauth2_scope = item.oauth2_scope || "";
                showDrawer();
            };

            function showDrawer() {
                root.openDrawer("authenticationDrawer");
            }

            vm.isUrlFieldValid = function (fieldName) {
                vm.validation[fieldName] = vm.current[fieldName].indexOf('https') >= 0;
            };

            vm.isBasicFieldValid = function (fieldName) {
                vm.validation[fieldName] = vm.current[fieldName].length > 0;
            };

            vm.cancelAddAndEdit = function() {
                root.closeDrawer("authenticationDrawer");
            };

            function resetValidation() {
                vm.validation = {
                    name: null,
                    base_url: null,
                    oauth2_client_id: null,
                    oauth2_client_secret: null,
                    oauth2_authorization_url: null,
                    oauth2_access_token_url: null
                };
            }

            vm.validateForm = function() {
                var errFieldId  = null;
                resetValidation();
                if (vm.current.name.length === 0 || (vm.items.filter(function(item) {
                    return (item.id !== vm.current.id) && (item.name.toLowerCase() === vm.current.name.toLowerCase())
                }).length > 0)) {
                    vm.validation.name = "A unique name is required for identifying this Authentication provider";
                    errFieldId = errFieldId || '#ap-name';
                }
                if (vm.current.oauth2_client_id.length === 0) {
                    vm.validation.oauth2_client_id = "A Client ID is required by the authentication provider";
                    errFieldId = errFieldId || '#ap-oauth2-client-id';
                }
                if (vm.current.oauth2_client_secret.length === 0) {
                    vm.validation.oauth2_client_secret = "A Client Secret is required by the authentication provider";
                    errFieldId = errFieldId || '#ap-oauth2-client-secret';
                }
                // authorization url is required only when using OAuth2.0
                if (vm.current.type === "oauth2" && (vm.current.oauth2_authorization_url.length === 0 || (vm.current.oauth2_authorization_url.indexOf('https') < 0)) ) {
                    vm.validation.oauth2_authorization_url = "A valid URL with 'https' is required";
                    errFieldId = errFieldId || '#ap-oauth2-authorization-url';
                }
                if (vm.current.oauth2_access_token_url.length === 0 || (vm.current.oauth2_access_token_url.indexOf('https') < 0)) {
                    vm.validation.oauth2_access_token_url = "A valid URL with 'https' is required";
                    errFieldId = errFieldId || '#ap-oauth2-access-token-url';
                }

                if (!errFieldId) {
                    saveItem();
                } else {
                    $(errFieldId).trigger("focus");
                }
            };

            function saveItem() {
                root.modal.show("Saving authentication provider");
                var requestOptions = {
                    method: vm.drawer_edit_mode ? 'PUT' : 'POST',
                    url: './authentication' + (vm.drawer_edit_mode ? '/' + vm.current.id : '/'),
                    data: vm.current
                };
                $http(requestOptions).then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success("Authentication Provider saved");
                            root.closeDrawer("authenticationDrawer");
                            vm.readData();
                        } else {
                            root.toastr.error("Sorry, an error occurred while saving authentication provider. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while saving authentication provider. Please try again");
                    }
                );
            }

            vm.itemToDelete = null;
            vm.deleteItem = function () {
                root.modal.show("Deleting authentication provider");
                $http.delete('./authentication/' + vm.itemToDelete.id).then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success("Authentication Provider deleted");
                            vm.readData();
                        } else {
                            root.toastr.error("Sorry, an error occurred while deleting authentication provider. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while deleting authentication provider. Please try again");
                    }
                );
            };
        });
})();