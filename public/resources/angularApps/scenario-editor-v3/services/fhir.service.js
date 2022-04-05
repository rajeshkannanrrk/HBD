angular.module('scenarioEditorApp.services')
    .service('$fhir', ['$http', '$q' ,function ($http, $q) {
        const readAPIdata = function (t)
        {
            return new $q( function (resolve, reject) {
                $http.get('../integration/data-connections/fhir/rest-api').then(
                    function(response) {
                        try {
                            t.api = response.data.api;
                            t.resources = response.data.resources;
                            resolve();
                        } catch (err) {
                            scope.toastr.error("Error reading fhir definitions.");
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

        const readDefinitions = function (t)
        {
            return new $q( function (resolve, reject) {
                $http.get('../integration/data-connections/fhir/monaco-js-definitions').then(
                    function(response) {
                        try {
                            t.monacoDefinitions = response.data;
                            resolve();
                        } catch (err) {
                            scope.toastr.error("Error reading fhir definitions.");
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

        this.refreshAPIdata = function ()
        {
            return readAPIdata(this);
        };

        this.refreshDefinitions = function ()
        {
            return readDefinitions(this);
        };

        this.apiLoaded = this.refreshAPIdata(this);
        this.definitionsLoaded = this.refreshDefinitions(this);



    }]);