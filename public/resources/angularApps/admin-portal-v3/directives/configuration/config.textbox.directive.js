'use strict';

angular.module('adminPortalApp.directives')
    .directive('configTextbox', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                info: "@",
                learnMore: "@",
                placeholder: "@",
                enabled: "="

            },
            templateUrl: '/resources/templates/config/config-textbox.html'
        };
    });
