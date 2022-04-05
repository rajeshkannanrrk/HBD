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

        const readDefinitionData = function (t, resourceName)
        {
            return new $q( function (resolve, reject) {
                $http.get('../integration/data-connections/fhir/monaco-js-definitions/' + resourceName).then(
                    function(response) {
                        try {
                            t.monacoDefinition = response.data;
                            resolve();
                        } catch (err) {
                            scope.toastr.error("Error reading monaco fhir definitions.");
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

        this.readResourceDefinitionList = function (resourceName)
        {
            return readDefinitionData(this, resourceName);
        };

        this.apiLoaded = this.refreshAPIdata(this);



    }]);