'use strict';

angular.module('adminPortalApp.directives')
    .directive('configBoolean', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                info: "@",
                textOn: "@",
                textOff: "@",
                link: "@",
                linkText: "@"

            },
            templateUrl: '/resources/templates/config/config-boolean.html'
        };
    });

