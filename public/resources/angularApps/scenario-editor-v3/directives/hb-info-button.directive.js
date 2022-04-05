'use strict';

angular.module('scenarioEditorApp.directives')
    .directive('hbInfoButton', function () {
        return {
            restrict: 'E',
            scope: {
                label: "@",
                disabled: "="

            },
            templateUrl: '/resources/templates/portal/hb-info-button.html'
        };
    });

