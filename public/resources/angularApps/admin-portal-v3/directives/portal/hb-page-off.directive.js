'use strict';

angular.module('adminPortalApp.directives')
    .directive('hbPageOff', function () {
        return {
            restrict: 'E',
            scope: {
                title: "@",
                subTitleLine: "@",
                icon: "@",
                buttonText: "@",
                buttonAction: "=",
           },
            templateUrl: '/resources/templates/portal/hb-page-off.html',
        };
    });