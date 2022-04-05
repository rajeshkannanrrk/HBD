'use strict';

angular.module('adminPortalApp.directives')
    .directive('hbPageHeader', function () {
        return {
            restrict: 'E',
            scope: {
                title: "@",
                icon: "@",
                subTitleLine1: "@",
                subTitleLine2: "@",
                subTitleLine3: "@",
                learnMore: "@"

            },
            templateUrl: '/resources/templates/portal/hb-page-header.html'
        };
    });

