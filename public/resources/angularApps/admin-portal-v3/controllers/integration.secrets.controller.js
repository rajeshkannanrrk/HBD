(function() {
    angular.module('adminPortalApp.controllers')
        .controller('secretsCtrl', function ($rootScope, $window, $scope, $http, $timeout, $moment, localStorageService, $location) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;
            vm.information = [];
            vm.secrets = [];
            vm.instrumentationKey = "";
            vm.customTelemetryPHI = false;

            vm.init = function () {
                vm.readInformation();
                vm.readSecrets();
                vm.readInstrumentationKey();
                vm.readCustomTelemetryPHI();
            };

            vm.readInformation = function () {
                root.modal.show();
                $http.get('./secrets/read/information').then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            vm.information = response.data;
                        } else {
                            vm.information = [];
                        }
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.modal.hide();
                        vm.information = [];
                        root.refreshTabIndices();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading information. Please try to refresh");
                    }
                );
            };

            vm.readSecrets = function () {
                root.modal.show();
                $http.get('./secrets/read/secrets').then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            vm.secrets = response.data;
                        } else {
                            vm.secrets = [];
                        }
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.modal.hide();
                        vm.secrets = [];
                        root.refreshTabIndices();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading secrets. Please try to refresh");
                    }
                );
            };

            vm.readInstrumentationKey = function () {
                root.modal.show();
                $http.get('./secrets/read/instrumentationKey').then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            vm.instrumentationKey = response.data;
                        } else {
                            vm.instrumentationKey = "";
                        }
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.modal.hide();
                        vm.instrumentationKey = "";
                        root.refreshTabIndices();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading instrumentation key. Please try to refresh");
                    }
                );
            };

            vm.executeSecretAction = function (actionName) {
                if (actionName === "generateApiKey") {
                    vm.generateApiKey();
                }
            };

            vm.generateApiKey = function() {
                root.modal.show("Generating new API key user");
                $http.post('./secrets/actions/generateApiKey', {})
                    .then(
                        function (response) {
                            root.modal.hide();
                            if (response.status === 200) {
                                root.modal.hide();
                                root.toastr.success('New API_JWT_secret created');
                                vm.readSecrets();
                            }
                            else {
                                root.modal.hide();
                                root.toastr.error("Sorry, an error occurred while generating new API key. Please try again");
                            }
                        },
                        function (response) {
                            root.modal.hide();
                            if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                            root.toastr.error("Sorry, an error occurred while generating new API key. Please try again");
                        }
                    );
            };

            vm.updateInstrumentationKey = function(val) {
                var instrumentationKeyPattern = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');
                if (val && !instrumentationKeyPattern.test(val)) {
                    root.toastr.error('Invalid instrumentation key');
                    
                    return;
                }
                
                vm.instrumentationKey = val;
                if (val !== "" && vm.customTelemetryPHI) {
                    $('#instrumentationKeyDisclaimerPopup').modal();
                }
                else {
                    vm.continueWithUpdateInstrumentationKey();
                }
            };

            vm.cancelUpdateInstrumentationKey = function() {
                vm.readInstrumentationKey();
            }

            vm.continueWithUpdateInstrumentationKey = function() {
                if (vm.instrumentationKey !== undefined) {
                    var val = vm.instrumentationKey;
                    root.modal.show("Updating instrumentation key");
                    $http.post('./secrets/actions/updateInstrumentationKey', {key: val})
                        .then(function (response) {
                            if (response.status === 200) {
                                vm.instrumentationKey = undefined;
                                vm.readInstrumentationKey();
                                root.modal.hide();
                                root.toastr.success('Instrumentation Key updated');
                            }
                            else {
                                vm.readInstrumentationKey();
                                vm.instrumentationKey = undefined;
                                root.modal.hide();
                                root.toastr.error("Sorry, an error occurred while updating instrumentation key. Please try again");
                            }
                        },
                        function (response) {
                            root.modal.hide();
                            vm.readInstrumentationKey();
                            vm.instrumentationKey = undefined;
                            if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                            root.toastr.error("Sorry, an error occurred while updating instrumentation key. Please try again");
                        }
                    );
                }
            }

            vm.readCustomTelemetryPHI = function () {
                root.modal.show();
                $http.get('./secrets/read/customTelemetryPHIState').then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            vm.customTelemetryPHI = response.data;
                        } else {
                            vm.customTelemetryPHI = false;
                        }
                        root.refreshTabIndices();
                    },
                    function(response) {
                        root.modal.hide();
                        vm.customTelemetryPHI = false;
                        root.refreshTabIndices();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading custom telemetry PHI state. Please try to refresh");
                    }
                );
            };


            vm.toggleCustomTelemetryPHI = function() {
                root.modal.show("Updating custom telemetry PHI state");
                $http.post('./secrets/actions/toggleCustomTelemetryPHIState')
                    .then(function (response) {
                        if (response.status === 200) {
                            vm.customTelemetryPHI = response.data;
                            root.modal.hide();
                            root.toastr.success('Custom telemetry PHI state updated');
                        }
                        else {
                            root.modal.hide();
                            root.toastr.error("Sorry, an error occurred while updating custom telemetry PHI state. Please try again");
                        }
                    },
                    function (response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while updating custom telemetry PHI state. Please try again");
                    }
                );

            };
        });
})();
