(function() {
    angular.module('scenarioEditorApp.services')
    .service('toolboxes', function ($rootScope, $http, localStorageService) {
        var root = $rootScope;
        var version = 2.0;

        function updateLocalStorage() {
            localStorageService.set('minimap', toolboxesService.minimap);
        }

        var toolboxesService = {};
        /***********************************************************
            Initialization of the service
         ***********************************************************/
        toolboxesService.minimap = localStorageService.get('minimap');
        if (toolboxesService.minimap === undefined || toolboxesService.minimap === null) {
            toolboxesService.minimap = true;
        }
        var minimapCSS = {
            position: 'absolute',
            right: '430px',
            top: '180px',
            opacity: '0.95'
        };
        updateLocalStorage();

        toolboxesService.displayMinimap = function(canvas) {
            canvas.mgMiniMap({elements: '.window', liveScroll: true, draggable: false});
            $('.mgHandle').html($('#minimap-title').html());

            $('.mgNavigator').css(minimapCSS);
            $('.mgNavigator').css('z-index', '999');
            setTimeout(toolboxesService.updateMgNavigatorPosition, 10);
        };

        toolboxesService.toggleMinimap = function(canvas) {
            updateLocalStorage();
            toolboxesService.minimap ? toolboxesService.displayMinimap(canvas) : $('.mgNavigator').remove();
        };

        toolboxesService.updateMgNavigatorPosition = function() {
            $('#designer').mgMiniMap('update');
            if ($('.right-pane').css('visibility') === 'hidden') {
                $('.mgNavigator').css('right', '30px');
            }
            else {
                $('.mgNavigator').css('right', $('.right-pane').width() + 30 + 'px');
            }
            $('.mgNavigator').css('left', '');
            $('.mgNavigator').css('top', $('.right-pane').position().top + 110 + 'px');

        }

        return toolboxesService;
    });
})();
