(function() {
    angular.module('adminPortalApp.controllers')
        .controller('resourcesCtrl', function ($rootScope, $scope, $http, $timeout, $window, $moment, localStorageService) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;

            /**************************************************************************************************
             * loading data on controller init event
             ***************************************************************************************************/

            vm.noResources = false;
            vm.resources = [];
            vm.init = function() {
                vm.loadData();
                $('#deleteResource').on('shown.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                $('#deleteResource').on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
            };
            vm.loadData = function() {
                root.modal.show();
                $http.get('./files/all').then(
                    function(response) {
                        vm.resources = [];
                        response.data.entries.forEach(function(blob) {
                            vm.resources.push({
                                name: blob,
                                url: response.data.blobUrl + '/' + blob,
                                isCode: isCode(blob),
                                isJS: isJS(blob),
                                isExcel: isExcel(blob),
                                isWord: isWord(blob),
                                isPdf: isPdf(blob),
                                isImg: isImg(blob),
                                pendingDelete: false
                            });
                        });
                        vm.noResources = (vm.resources.length === 0);
                        root.modal.hide();
                        root.refreshTabIndices();
                    },
                    function(httpError) {
                        vm.noResources = true;
                        root.modal.hide();
                        root.refreshTabIndices();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading resource list. Please try again");

                    }
                );
            };

            function isCode(name) {
                var ext = name.toLowerCase().split(".").pop();
                return ["htm", "html", "css", "ini", "config", "txt"].indexOf(ext) >= 0;
            }

            function isJS(name) {
                var ext = name.toLowerCase().split(".").pop();
                return ["js", "json"].indexOf(ext) >= 0;
            }

            function isPdf(name) {
                var ext = name.toLowerCase().split(".").pop();
                return ["pdf"].indexOf(ext) >= 0;
            }

            function isExcel(name) {
                var ext = name.toLowerCase().split(".").pop();
                return ["xls", "xlsx"].indexOf(ext) >= 0;
            }

            function isWord(name) {
                var ext = name.toLowerCase().split(".").pop();
                return ["doc", "docx"].indexOf(ext) >= 0;
            }

            function isImg(name) {
                return !(isCode(name) || isExcel(name) || isWord(name) || isJS(name) || isPdf(name));
            }

            vm.resourceToDelete = null;
            vm.showDelete = function(resource) {
                vm.resourceToDelete = resource;
            };

            vm.executeDelete = function () {
                $('#deleteResource').modal('hide');
                root.modal.show('Deleting resource');
                $http.delete('./files/delete?name=' + vm.resourceToDelete.name).then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success("Resource Deleted");
                            vm.loadData();
                        } else {
                            root.toastr.error("Sorry, an error occurred while deleting resource. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while deleting resource. Please try again");
                    }
                );
            };

            vm.addNewResource = function(action, i) {
                if (!action) {
                    root.openDrawer("newResourceDrawer");
                }
                else if (action == 'cancel') {
                    $('#resourceToUpload')[0].value = "";
                    $('#upload-file-info').html('');

                    root.closeDrawer("newResourceDrawer");
                }
                else if (action == 'validate') {
                    saveResource();
                }
            };

            vm.browseFile = function() {
                var elem = document.getElementById('resourceToUpload');
                if(elem && document.createEvent) {
                    var evt = document.createEvent("MouseEvents");
                    evt.initEvent("click", true, false);
                    elem.dispatchEvent(evt);
                }
            };

            function saveResource() {
                var form = new FormData();
                var filesArr = $('#resourceToUpload')[0].files;
                if (filesArr.length === 0) {
                    return root.toastr.error('Please select a file to upload');
                }
                for (var i = 0 ; i < filesArr.length; i++) {
                    var f = filesArr[i]
                    form.append('f_' + i, f);
                }
                root.modal.show('Uploading resource');
                $http({
                    method: 'POST',
                    url: './files/upload',
                    data: form,
                    headers: { 'Content-Type': undefined},
                    transformRequest: angular.identity
                }).then(function successCallback(response) {
                    root.modal.hide();
                    if (response.status === 200) {
                        root.toastr.success('Resource uploaded');
                        root.closeDrawer("newResourceDrawer");
                        vm.loadData();
                    } else {
                        root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data);
                    }
                }, function errorCallback(response) {
                    root.modal.hide();
                    if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    root.toastr.error("An error occurred while uploading new resources.<br>Make sure the file in the following format: 'abc.xyz' and smaller than 10MB and please try again");
                });
            }
        });
})();
