'use strict';

angular.module('adminPortalApp.directives')
    .directive('configRange', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                info: "@",
                learnMore: "@",
                min: "@",
                max: "@",
                id: "@"
            },
            templateUrl: '/resources/templates/config/config-range.html'
        };
    });

