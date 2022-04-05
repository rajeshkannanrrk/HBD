'use strict';

angular.module('adminPortalApp.directives')
    .directive('configStringList', function () {
        return {
            restrict: 'E',
            scope: {
                ctrl: "=",
                variable: "=",
                label: "@",
                listId: "@",
                info: "@",
                learnMore: "@",
                placeholder: "@",
                colName: "@"
            },
            templateUrl: '/resources/templates/config/config-strings-list.html'
        };
    });

