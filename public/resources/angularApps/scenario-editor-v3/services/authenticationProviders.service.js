angular.module('scenarioEditorApp.services')
    .service('$authenticationProviders', ['$http', '$q' ,function ($http, $q) {
        const internalRefresh = function (t)
        {
            return new $q( function (resolve, reject) {
                $http.get('../integration/authentication/read').then(
                    function(response) {
                        try {
                            t.authenticationProviders = response.data;
                            resolve();
                        } catch (err) {
                            scope.toastr.error("Error reading authentication providers.");
                            reject(err);
                        }
                    },
                    function(httpError) {
                        console.log(httpError);
                        reject(httpError);
                    }
                );
            });
        };

        this.refreshData = function ()
        {
            return internalRefresh(this);
        };

        this.dataLoaded = this.refreshData(this);
    }]);