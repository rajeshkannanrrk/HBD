'use strict';

angular.module('adminPortalApp.directives')
    .directive('readFile', function ($parse, $http) {
        return {
            restrict: 'A',
            scope: false,
            link: function(scope, element, attrs) {
                var fn = $parse(attrs.readFile);
                element.on('change', function(onChangeEvent) {
                    var err = null;
                    var res = [];
                    var names = {};
                    var completionCount = 0;
                    try
                    {
                        var files = (onChangeEvent.srcElement || onChangeEvent.target).files;
                        for (var i = 0; i < files.length; i++) {
                            var reader = new FileReader();
                            var fileObj = {
                                fileName: files[i].name,
                                _file: files[i],
                                scenarioName: null,
                                scenarioDescription: null,
                                scenarioTrigger: null,
                                valid: false,
                                skip: true
                            };
                            res.push(fileObj);
                            reader.onload = function(onLoadEvent) {
                                //res[this.innerId].data = (onLoadEvent.target.result);
                                try {
                                    var d = JSON.parse(onLoadEvent.target.result);
                                    if (names[d.name] === true && err === null) {
                                        err = d.name + ' was selected more than once';
                                    }
                                    names[d.name] = true;
                                    res[this.innerId].scenarioName = d.name;
                                    res[this.innerId].scenarioTrigger = d.scenario_trigger;
                                    res[this.innerId].scenarioDescription = d.description;
                                    res[this.innerId].valid = d.name !== undefined && d.description !== undefined && d.code !== undefined;
                                } catch(e) {
                                    res[this.innerId].valid = false;
                                }
                                completionCount++;
                                if (completionCount === files.length) {
                                    fn(scope, {$fileContent:{res:res, err:err}});
                                }
                            };
                            reader.innerId = i;
                            reader.readAsText(files[i]);
                        }
                    }
                    catch(err)
                    {
                        console.log('readFile - ' + err);
                    }
                    return false;
                });
            }
        };
    });