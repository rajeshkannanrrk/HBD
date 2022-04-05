'use strict';

angular.module('adminPortalApp.directives')
    .directive('readFile', function ($parse, $http) {
        return {
            restrict: 'A',
            scope: false,
            link: function(scope, element, attrs) {
                element.on('change', function(onChangeEvent) {
                    try
                    {
                        var files = (onChangeEvent.srcElement || onChangeEvent.target).files;
                        for (var i = 0; i < files.length; i++) {
                            var reader = new FileReader();
                            reader.onload = function(onLoadEvent) {
                                var data = onLoadEvent.target.result;
                                var workbook = XLSX.read(data, {type: 'binary'});
                                var ws = workbook.Sheets[workbook.SheetNames[0]];
                                var sheetObject = XLSX.utils.sheet_to_json(ws, { defval: '' });
                                scope.$localizationCtrl.processLocalizationSheet({sheet:sheetObject, err:null});
                            };
                            reader.innerId = i;
                            scope.$localizationCtrl.importFilePath = files[i].name;
                            reader.readAsBinaryString(files[i]);
                        }
                    }
                    catch(err)
                    {
                        console.log('readFile - ' + err);
                        scope.$localizationCtrl.processLocalizationSheet({$fileContent:{sheet:null, err:err}});
                    }
                    return false;
                });
            }
        };
    });