(function() {
    angular.module('adminPortalApp.controllers')
        .controller('searchInScenariosCtrl', function ($rootScope, $scope, $http, $timeout, $window) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var vm = this;
            var root = $rootScope;
            vm.modal = root.modal;

            /**************************************************************************************************
             * This function will init the controller
             ***************************************************************************************************/
            vm.init = function() {};

            vm.term = "";
            vm.results = [];
            vm.search = function(){
                if (vm.term.length === 0) {
                    $('#results').html("");
                }
                else {
                    vm.modal.show();
                    $http.post("./search?phrase=" + vm.term).then(function(response){
                        var newHTML = "";
                        vm.modal.hide();
                        response.data.forEach(function(item, i) {
                            newHTML += "<h3><a class=\"url-to-scenario\" target=\"_blank\" href=\"./../scenario-editor/" + item.id + "\">";
                            newHTML += item.scenarioDetails.name;
                            newHTML += "</a></h3>";
                            try {
                                newHTML += '<pre>' + JSON.stringify(JSON.parse(item["content"]), null, 4) + '</pre>';
                            } catch (e) {
                                newHTML += '<pre>' + item["content"] + '</pre>';
                            }

                        });
                        $('#results').html(newHTML);
                    }, function(){
                        vm.modal.hide();
                    });
                }
            }
        });
})();
