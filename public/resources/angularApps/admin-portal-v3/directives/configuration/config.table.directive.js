'use strict';

angular.module('adminPortalApp.directives')
    .directive('configTable', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                tableId: "@",
                info: "@",
                learnMore: "@",
                noTitle: "@",
                fields: "=",
                immutable: "="
            },
            templateUrl: '/resources/templates/config/config-table.html'
        };
    });

