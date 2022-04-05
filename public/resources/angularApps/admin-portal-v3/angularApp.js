(function() {
    angular.module('adminPortalApp.preloadedData', []);

	angular.module('adminPortalApp', [
		'adminPortalApp.controllers',
        'adminPortalApp.services',
        'adminPortalApp.objects',
        'adminPortalApp.directives',
        'adminPortalApp.preloadedData',
		'LocalStorageModule',
        'angular-momentjs',
        'cp.ngConfirm',
        'ui.select',
        'ngSanitize'
	]).config(function (localStorageServiceProvider) {
        localStorageServiceProvider.setPrefix('mshtenants');
    }).config(function($momentProvider){
        $momentProvider
            .asyncLoading(false)
            .scriptUrl('/node_modules/moment/min/moment.min.js');
    }).factory('tenantHttpInterceptor', ['$q', function($q) {
        var path = {
            request: function(config) {
                config.headers['x-is-angular'] = true;
                if (config.url.substr(-1) === "/") {
                    config.url = config.url.substr(0, config.url.length - 1);
                }
                return config;
            },
            responseError: function(response) {
                if (response.status == 401 && response.data.login)
                {
                    window.location = response.data.login;
                }
                return $q.reject(response);
            }
        };
        return path;
    }]).config(['$httpProvider', function($httpProvider) {
        $httpProvider.interceptors.push('tenantHttpInterceptor');
    }]);
})();
