angular.module('scenarioEditorApp.services')
    .service('$dataConnections', ['$http', '$q' ,function ($http, $q) {
        const internalRefresh = function (t)
        {
            return new $q( function (resolve, reject) {
                $http.get('../integration/data-connections/read').then(
                    function(response) {
                        try {
                            t.dataConnections = response.data;
                            resolve();
                        } catch (err) {
                            scope.toastr.error("Error reading data connections.");
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