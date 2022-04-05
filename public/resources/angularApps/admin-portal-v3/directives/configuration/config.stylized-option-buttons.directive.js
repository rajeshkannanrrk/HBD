'use strict';

angular.module('adminPortalApp.directives')
    .directive('configStylizedOptionButtons', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                info: "@",
                learnMore: "@",
                options: "=",
                changedWarnings: "="
            },
            templateUrl: '/resources/templates/config/config-stylized-option-buttons.html'
        };
    });

