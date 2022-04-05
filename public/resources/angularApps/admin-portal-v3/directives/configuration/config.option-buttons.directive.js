'use strict';

angular.module('adminPortalApp.directives')
    .directive('configOptionButtons', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                info: "@",
                learnMore: "@",
                special: "@",
                type: "@",
                placeholder: "@",
                options: "="
            },
            templateUrl: '/resources/templates/config/config-option-buttons.html'

        };
    });

