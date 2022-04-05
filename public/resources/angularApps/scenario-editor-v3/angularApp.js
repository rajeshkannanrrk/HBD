(function() {
    angular.module('scenarioEditorApp', [
        'scenarioEditorApp.controllers',
        'scenarioEditorApp.services',
        'scenarioEditorApp.directives',
        'ui.select',
        'ngSanitize'
    ])
        .constant('constants', {
            "prompt": new PromptHandler(),
            "branch":new BranchHandler(),
            "switch":new SwitchHandler(),
            "statement":new StatementHandler(),
            "beginScenario":new BeginScenarioHandler(),
            "replaceScenario":new ReplaceScenarioHandler(),
            "datasource":new DatasourceHandler(),
            "globalContext":new GlobalContextHandler(),
            "action" : new ActionHandler(),
            "wait" : new WaitHandler(),
            "luis" : new LUISHandler(),
            "yesnoprompt" : new YesNoPrompthHandler(),
            "endwithresult": new EndWithResultHandler(),
            "assignVariable": new AssignVariableHandler(),
            "invokeSkill": new InvokeSkillHandler(),

        })
        .constant('uiMonacoeditorConfig', {})
        .config([
            '$compileProvider',
            'localStorageServiceProvider',
            function($compileProvider, localStorageServiceProvider) {
                $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension|data):/);
                localStorageServiceProvider.setPrefix('mshdesigner');
            }
        ]).factory('scenarioHttpInterceptor', ['$q', '$location',function($q, $location) {
        var path = {
            request: function(config) {
                config.headers['x-is-angular'] = true;
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
    }])
        .config(function () {
            angular.element(document).on('keyup', function (e) {
                switch (e.keyCode) {
                    case 46:
                    case 110:
                        $('#globalDeleteButton').trigger("click");
                        break
                }

            })
        })

        .config(['$httpProvider', function($httpProvider) {
        $httpProvider.interceptors.push('scenarioHttpInterceptor');
    }]);
})();
