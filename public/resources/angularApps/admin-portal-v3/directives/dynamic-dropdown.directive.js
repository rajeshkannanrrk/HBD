'use strict';

angular.module('adminPortalApp.directives')
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

