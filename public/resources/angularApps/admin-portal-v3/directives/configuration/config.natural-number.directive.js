'use strict';

angular.module('adminPortalApp.directives')
    .directive('configNaturalNumber', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                info: "@",
                learnMore: "@"
            },
            templateUrl: '/resources/templates/config/config-natural-number.html'
        };
    });

