'use strict';

angular.module('scenarioEditorApp.directives')
    .directive('dynamicDropdown', function () {
        return {
            restrict: 'E',
            scope: {
                localizedStrings: '=',
                selectedString: '=',
                refreshStrings: '&',
                onSelect: '&',
                saveString: '&'
            },
            templateUrl: '/resources/templates/dynamic-dropdown.html'
        };
    });

