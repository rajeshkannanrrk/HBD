(function() {
    angular.module('adminPortalApp.controllers')
        .controller('usersCtrl', function ($rootScope, $scope, $http, $timeout, $window) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;
            vm.drawer_edit_mode = false;
            vm.current = {};
            vm.drawer_title = "New Data connection";

            /**************************************************************************************************
             * loading data on controller init event
             ***************************************************************************************************/
            vm.init = function() {
                vm.loadData();
                $('#deleteUser').on('shown.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                $('#deleteUser').on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
            };

            vm.loadData = function(cb) {
                vm.users = [];
                root.modal.show();
                $http.get('./manage/all').then(
                    function(response) {
                        vm.users = response.data.map(function(user) {
                            user.role = user.isAdmin ? "4" : user.isEditor ? "3" : "2";
                            user.origRole = user.isAdmin ? "4" : user.isEditor ? "3" : "2";
                            user.pendingDelete = false;
                            return user;
                        });
                        root.modal.hide();
                        root.refreshTabIndices();
                    },
                    function(response) {
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while reading user list. Please try again");
                        root.refreshTabIndices();
                    }
                );
            };
            
            vm.getMembers = function (viewValue) {
                vm.members = [];
                return $http.get('./manage/members?filter=' + viewValue).then(
                    function(response) {
                        return response.data;
                    },
                    function(response) {
                        root.toastr.error("Sorry, an error occurred while reading user list. Please try again");
                    }
                )
            }

            vm.addNewUser = function(action, i) {
                if (!action) {
                    vm.validation = {
                        email: null
                    };
                    vm.newUser = {
                        email: "",
                        role: "3"
                    };
                    root.openDrawer("newUserDrawer");
                }
                else if (action == 'cancel') {
                    root.closeDrawer("newUserDrawer");
                }
                else if (action == 'validate') {
                    if (vm.newUser.email.length === 0) {
                        vm.validation.email = "A valid AAD or LiveID email must be provided.";
                        $('#email').trigger("focus");
                        return;
                    }
                    else {
                        saveUser();
                    }
                }
            };

            function saveUser() {
                root.modal.show("Adding user");
                $http.post("./manage/add",
                    {
                        email: vm.newUser.email.mail || vm.newUser.email,
                        role: vm.newUser.role,
                        objectId: vm.newUser.email.objectId
                    }
                ).then(
                    function onSuccess(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success('user added successfully');
                            root.closeDrawer("newUserDrawer");
                            setTimeout(function() {
                                vm.loadData();
                            })
                        } else {
                            root.toastr.error("Sorry, an error occurred while adding user. Please try again");
                        }
                    },
                    function onError(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while adding user. Please try again");
                    }
                );
            }
            vm.userToDelete = null;
            vm.showDelete = function(user) {
                vm.userToDelete = user;
            };

            vm.executeDelete = function () {
                $('#deleteUser').modal('hide');
                root.modal.show("Deleting user");
                $http.get('./manage/delete?userId=' + vm.userToDelete.RowKey).then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success("User deleted");
                            vm.loadData();
                        } else {
                            root.toastr.error("Sorry, an error occurred while deleting user. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while deleting user. Verify that you are not removing the last admin, and try again");
                    }
                );
            };
            
            vm.changeRole = function (user) {
                if (user.origRole === user.role) {
                    return;
                }
                root.modal.show("Updating user role");
                $http.patch('./manage/role?userId=' + user.RowKey + '&newRole=' + user.role).then(
                    function(response) {
                        root.modal.hide();
                        if (response.status === 200) {
                            root.toastr.success("User role updated");
                            vm.loadData();
                        } else {
                            root.toastr.error("Sorry, an error occurred while changing user's role. Verify that you are not removing the last admin, and try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        if (response.status === 403) { return root.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                        root.toastr.error("Sorry, an error occurred while changing user's role. Verify that you are not removing the last admin, and try again");
                    }
                );
                document.activeElement.blur();
            };
        });
})();
