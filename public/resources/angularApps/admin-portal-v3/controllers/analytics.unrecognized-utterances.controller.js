(function() {
    angular.module('adminPortalApp.controllers')
        .controller('unrecognizedUtterancesCtrl', function ($rootScope, $scope, $http, $timeout, $window) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;
            vm.items = [];
            vm.dateFilter = 'forever';
            vm.textFilter = "";
            vm.textFilterOnline = "";
            vm.usedDateFilter = 'forever';
            vm.loading = true;

            vm.applyFilter = function() {
                vm.textFilterOnline = vm.textFilter.toLowerCase();
                updateFilter();
            };

            vm.clearFilter = function () {
                if (vm.loading || vm.processing) {
                    return;
                }
                vm.textFilter = "";
                vm.applyFilter();
            };

            function updateFilter() {
                vm.filtered = 0;
                vm.items.forEach(function(item) {
                    item.selected = item.full.toLowerCase().indexOf(vm.textFilterOnline.toLowerCase()) > -1;
                    if (item.selected) {
                        vm.filtered++;
                    }
                })
            }

            vm.filtered = 0;

            vm.nextRequest = {
                continuationToken: null,
                dateFilter: vm.dateFilter
            };

            vm.readData = function(readNext) {
                vm.loading = true;
                if (!readNext) {
                    vm.nextRequest.dateFilter = vm.dateFilter;
                    root.modal.show();
                }

                uri = './unrecognized-utterances/read?range=' + vm.nextRequest.dateFilter + '&continuationToken=' + JSON.stringify(vm.nextRequest.continuationToken);
                if (!readNext) {
                    vm.filtered = 0;
                    vm.items = [];
                    var uri = './unrecognized-utterances/read?range=' + vm.nextRequest.dateFilter;
                }
                $http.get(uri).then(
                    function(response) {
                        vm.processing = true;
                        addByChunks(response.data.items);
                        vm.nextRequest.continuationToken = response.data.continuationToken;
                        if (!readNext) {
                            root.modal.hide();
                        }
                        vm.loading = false;
                    },
                    function(httpError) {
                        if (!readNext) {
                            root.modal.hide();
                        }
                        vm.loading = false;
                    }
                );
                setTimeout(function () {$scope.$apply();}, 10);
            };

            function addByChunks(itemsToAdd) {

                var chunkSize = Math.max(Math.floor(itemsToAdd.length * 0.05), 7);
                while (itemsToAdd.length > 0 && chunkSize > 0) {
                    var item = itemsToAdd.shift();
                    item.selected = item.full.toLowerCase().indexOf(vm.textFilterOnline) > -1;
                    vm.filtered += (item.selected) ? 1 : 0;
                    vm.items.push(item);
                    chunkSize--;
                }

                if (itemsToAdd.length > 0) {
                    setTimeout(function () {
                        addByChunks(itemsToAdd);
                        $scope.$apply();
                    }, 3);
                }
                else {
                    vm.processing = false;
                }
            }

            vm.exportData = function () {
                root.modal.show();
                $http.post('./unrecognized-utterances/export').then(
                    function(response) {
                        root.modal.hide();
                        var a = document.createElement("a");
                        document.body.appendChild(a);
                        a.style = "display: none";
                        blob = new Blob([response.data], {type: "octet/stream"}),
                            url = window.URL.createObjectURL(blob);
                        a.href = url;
                        a.download = 'misunderstood.csv';
                        a.click();
                        window.URL.revokeObjectURL(url);
                    },
                    function(httpError) {
                        root.modal.hide();
                        root.toastr.error("Sorry, an error occurred while exporting unrecognized utterances list. Please try again");
                    }
                );
            };
        });
})();