'use strict';

angular.module('adminPortalApp.directives')
    .directive('configSelectTimeOptions', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                selectionId: "@",
                info: "@",
                learnMore: "@",
                type: "@",
                options: "="
            },
            templateUrl: '/resources/templates/config/config-select-time-options.html'
        };
    });
