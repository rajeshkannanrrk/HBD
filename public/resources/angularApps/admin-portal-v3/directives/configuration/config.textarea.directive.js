'use strict';

angular.module('adminPortalApp.directives')
    .directive('configTextarea', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                info: "@",
                learnMore: "@"

            },
            templateUrl: '/resources/templates/config/config-textarea.html'
        };
    });

