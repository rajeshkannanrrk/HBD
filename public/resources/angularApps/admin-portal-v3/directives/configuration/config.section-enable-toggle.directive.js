'use strict';

angular.module('adminPortalApp.directives')
    .directive('configSectionEnableToggle', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                disableToggle: "@"
            },
            templateUrl: '/resources/templates/config/config-section-enable-toggle.html'
        };
    });

