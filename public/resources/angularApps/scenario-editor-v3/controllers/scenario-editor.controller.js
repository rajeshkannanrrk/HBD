(function() {
    angular.module('scenarioEditorApp.controllers', ['ui.bootstrap', 'LocalStorageModule','jsonFormatter'])
        .controller('MainCtrl', function($window, $rootScope, $scope, $uibModal, $compile, $http, constants, $guid, localStorageService, $sce, toolboxes, $location, $dataConnections, $autocomplete){
            $scope.rightPaneMinimized = false;
            $scope.toolboxes = toolboxes;
            $scope.logActivity = function() {
                $http.post('/activity');
            };

            window.toastr.options = {
                "closeButton": true,
                "debug": false,
                "newestOnTop": true,
                "progressBar": true,
                "positionClass": "toast-top-right",
                "preventDuplicates": false,
                "onclick": null,
                "showDuration": "200",
                "hideDuration": "200",
                "timeOut": "5000",
                "extendedTimeOut": "1000",
                "showEasing": "swing",
                "hideEasing": "linear",
                "showMethod": "fadeIn",
                "hideMethod": "fadeOut",
                "escapeHtml": true
            };

            $scope.logout = function () {
                $scope.modal.show('Logging out');
                $http.post('/logout').then(function (response) {
                    if (response.status === 200) {
                        location.reload();
                    }
                    else {
                        $scope.modal.hide();
                        window.toastr.error('sorry');
                    }
                }, function (err) {
                    $scope.modal.hide();
                    window.toastr.error('sorry');
                } )
            };
            $scope.webchat_locale = {
                selected: "en-US"
            };
            $scope.openWebchatDrawer = function() {
                $scope.drawer.open('webchatDrawer');
                $scope.loadWebChatDemo();
            };

            $scope.planData = null;
            $scope.readPlanData = function() {
                $http.get('../plan').then(
                    function(response) {
                        if (response.data.planId && response.data.msgCount && response.data.maxMessages) {
                            var plan = response.data.planId[0].toUpperCase() + response.data.planId.slice(1).toLowerCase();
                            var c = Number(response.data.msgCount);
                            var m = Number(response.data.maxMessages);
                            var perc = Math.min(100, Math.floor((100* c) / m));
                            var cls = perc < 60 ? "progress-bar progress-bar-good" : perc < 80 ? "progress-bar progress-bar-warning" : "progress-bar progress-bar-danger";

                            c = c < 1000 ? c : (c >= 1000 && c < 1000000) ? Math.floor(c / 1000) + 'K' : Math.floor(c / 1000000) + 'M';
                            m = m < 1000 ? m : (m >= 1000 && m < 1000000) ? Math.floor(m / 1000) + 'K' : Math.floor(m / 1000000) + 'M';
                            $scope.planData = {
                                plan: plan,
                                usage: "Used " + c + " / " + m + " monthly messages",
                                perc: perc,
                                cls: cls
                            }
                        }
                    },
                    function(httpError) {
                        $scope.planData = null;
                    });
            };
            $scope.readPlanData();
            $scope.loadWebChatDemo = function(force){
                if (force || !$('#webChatIframe').attr('src')) {
                    if ($('#webChatIframe').attr('src')) {
                        $('#webChatIframe').css('opacity', '0');
                    }
                    $('#webChatIframe').attr('src', $('#webChatIframe').attr('webchat') + "&locale=" + $scope.webchat_locale.selected);
                    $('#webChatIframe')[0].onload = function (a) {
                        $('#webChatIframe').css('opacity', '1');
                    }
                }
            };

            function updateLastModified(dateString) {
                var d = dateString ? new Date(dateString): new Date();
                $('.last-modified').html("Last edited on " + d.toDateString() + " " + d.getHours() + ":" + d.getMinutes() +" by " + $('.user-name').html());
                $('.last-modified').show();
            }
                            function readLocalizationSettings() {
                    $http.get('./localizationSettings')
                        .then(
                            function(response) {
                                $scope.localizationSettings = response.data;
                            },
                            function(err) {
                                window.toastr.error('Unexpected error occurred. please refresh this page');
                                console.log(err);
                            }
                        );
                }

                function readLocalizedStrings() {
                    $http.get('./localizationStrings')
                        .then(
                            function(response) {
                                $scope.existingLocalizationStrings = []
                                    .concat(response.data.mergedLocalizedStrings.stringIds.map(function(stringId) {
                                        return {
                                            type: "system_localization",
                                            value: '"' + stringId + '"',
                                            label: stringId,
                                            documentation: response.data.mergedLocalizedStrings["en-us"][stringId]
                                        };
                                    }))
                                    .concat(response.data.customLocalizedStrings.stringIds.map(function(stringId) {
                                        return {
                                            type: "custom_localization",
                                            value: '"' + stringId + '"',
                                            label: stringId,
                                            documentation: response.data.customLocalizedStrings["en-us"][stringId]
                                        };
                                    }));
                            },
                            function(err) {
                                window.toastr.error('Unexpected error occurred. please refresh this page');
                                console.log(err);
                            }
                        );
                }
            $rootScope.modal = $scope.modal = {
                show: function (phrase) {
                    $('.spinner .spinner-label').html(phrase || "Loading...");
                    $('.spinner').show();
                },
                hide: function () {
                    $('.spinner').hide();
                }
            };

            $(document).ready(function() {
                $scope.DOM = {
                    active: $('#active')
                };

                var ContextualMenuElements = document.querySelectorAll(".ms-ContextualMenuExample");
                for (var i = 0; i < ContextualMenuElements.length; i++) {
                    var ButtonElement = ContextualMenuElements[i].querySelector(".ms-Button");
                    var ContextualMenuElement = ContextualMenuElements[i].querySelector(".ms-ContextualMenu");
                    new fabric['ContextualMenu'](ContextualMenuElement, ButtonElement);
                }

                updateLastModified($('.last-modified').html())
            });
            $scope.evalExpression = "";
            $scope.justLoaded = true;
            /**
             * Setup the main json editor window
             */
            $scope.monacoEditorOptions = {
                language: "json"

            };

            require(["vs/editor/editor.main"], function () {
                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: true,
                });
                monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ noLib: true, allowNonTsExtensions: true , typeRoots:["/resources/types"]});
                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                    validate: false
                });

                // Load the types
                $.get("/resources/types.d.txt", function(d){
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(
                    d, '/resources/types.d.ts');
                });
            });

            $scope.evalEditorOptions = {
                language: "javascript",
                lineNumbers: false,
                actions: [{
                    label: 'Evaluate Expression',
                    id: 'evalExpression-id',
                    contextMenuGroupId: 'actions',
                    keybindings: [
                        67
                    ],
                    run: function(ed) {
                        $scope.evaluateExpression(ed.getModel().getValue());
                        $scope.$apply();
                    }
                }]
            };

            $scope.evalEditorResultsOptions = {
                language: "javascript",
                lineNumbers: false,
                readOnly: true,
                scrollbar: {horizontalHasArrows: true, horizontal:'visible', horizontalScrollbarSize: 17, arrowSize: 30}
            };

            $scope.evaluateExpression = function(val) {
                $scope.logActivity();

                if (!$scope.debugcontext) {
                    return;
                }
                var privateExptrV2 = /\bscenario\.(\w+)/g;
                var userExprV2 = /\buser\.(\w+)/g;
                var globalExprV2 = /\bconversation\.(\w+)/g;

                var evalExpression = val;
                var dialogPath = $scope.getDialogPath($scope.debugcontext.scenarioStack);
                evalExpression = evalExpression.replace(userExprV2, "$scope.debugcontext.user.$1");
                evalExpression = evalExpression.replace(globalExprV2, "$scope.debugcontext.conversation.$1");
                evalExpression = dialogPath ? evalExpression.replace(privateExptrV2, "$scope.debugcontext.conversation." + dialogPath + ".$1") :
                                              evalExpression.replace(privateExptrV2, "$scope.debugcontext.conversation.$1");
                try {
                    // Locally evaluate the variable - convert the result into string
                    $scope.evalResults = JSON.stringify(eval(evalExpression), undefined, '  ');
                }
                catch (err)  {
                    // Handler expression error, show error message as the result
                    $scope.evalResults = err.message;
                }
            };

            $scope.getDialogPath = function(stack) {
                if (!stack) {
                    return undefined;
                }

                var str = '/scenarios';
                const scenarios = stack.filter(function(s) {return s.substring( 0, str.length ) === str });
                const dialogPath  = scenarios.map(function (s) {
                    return '_' + s.replace(/^.*[\\\/]/, '');
                }).join('.');
                return dialogPath === '' ? undefined : dialogPath;
            }

            // Open socket with info about this scenario
            var socket = io($location.protocol() + "://" + $location.host() + ":" + $location.port(), {
                query: "id=" + scenarioId() + "&tenantId=" + tenantId() + "&tenantName=" + tenantName() + "&userName=" + userName() + "&userRole=" + userRole() + "&sysAdminReadOnly=" + sysAdminReadOnly()
            });

            function scenarioId() {
                return $('#id').val();
            }

            function tenantId() {
                return $('#tenantId').val();
            }

            function tenantName() {
                return $('#tenantName').val();
            }

            function userName() {
                return $('#userName').val();
            }

            function userRole() {
                return $('#userRole').val();
            }

            function sysAdminReadOnly() {
                return $rootScope.readonly ? 'true' : 'false';
            }

            function editingEventData() {
                return {
                    userRole: userRole(),
                    id: scenarioId(),
                    tenantId: tenantId(),
                    tenantName: tenantName(),
                    userName: userName(),
                    sysAdminReadOnly: sysAdminReadOnly()
                }
            }

            $rootScope.socket = {
                enterEditor: function() {
                    if ($('#id').val() !== '') {
                        socket.emit("editingScenario", editingEventData());
                    }
                },
                exitEditor: function(reasonToSkip) {
                    socket.emit("exitScenario", editingEventData());
                    if (!reasonToSkip) {
                        $scope.modal.show('Exiting scenario editor...');
                        window.location.href = window.location.href + "/../../scenarios/manage";
                    }
                }
            };

            $scope.exitEditor = function() {
                $rootScope.socket.exitEditor();
            };

            $scope.enterEditor = function() {
                $rootScope.socket.enterEditor();
            };

            socket.on('localizationSettingsChanged', function(e){
                if (e.tenantId === $('#tenantId').val()) {
                    readLocalizedStrings();
                }
            });

            socket.on('notifyEditing', function(e){
                if (e.id === $('#id').val() && e.userName !== $('#userName').val()) {
                    window.toastr.warning(e.userName + ' has opened this scenario as well. Your changes may overwrite each other');
                }
            });

            socket.on('notifyDoneEditing', function(e) {
                // The other user left the editor, mark me as editor
                if (e.id === scenarioId()) {
                    window.toastr.info(e.userName + ' has closed this scenario');
                    $scope.enterEditor();
                }
            });

            $rootScope.toggleReadOnlyCallback = function() {
                if ($rootScope.readonly) {
                    $rootScope.socket.exitEditor("stayInPage");
                }
                else {
                    $rootScope.socket.enterEditor();
                }
            };

            var instance = window.jsp = jsPlumb.getInstance({
                // default drag options
                DragOptions: { cursor: 'pointer', zIndex: 2000 },
                PaintStyle: { strokeStyle: '#5c96bc', lineWidth: 1, outlineColor: "transparent"},
                EndpointStyle: { width: 20, height: 16, strokeStyle: '#666' },
                Endpoint: ["Dot", {radius: 5} ],
                ConnectionOverlays: [
                    [ "Arrow", { location: 0.7, width: 10, length: 10}]
                ],
                Connector: [ "StateMachine", { curviness: 0 } ],
                Container: "canvas"
            });

            window.setZoom = function(zoom, instance, el) {
                instance = instance || jsPlumb;
                el = el || instance.getContainer();
                var p = ["webkit", "moz", "ms", "o"],
                    s = "scale(" + zoom + ")";

                for (var i = 0; i < p.length; i++) {
                    el.style[p[i] + "Transform"] = s;
                    el.style[p[i] + "TransformOrigin"] = "0px 0px";
                }
                el.style["height"] = ((1 / zoom) * 100) + "%";
                el.style["width"] = ((1 / zoom) * 100) + "%";
                el.style["transform"] = s;
                el.style["transformOrigin"] = "0px 0px";

                instance.setZoom(zoom);
            };

            $scope.newScope = $scope.$new();

            $scope.codeTabSelected = function() {
                $scope.logActivity();
                if ($scope.activeTab === 0) {
                    return;
                }
                $('.mgNavigator').remove();
                $scope.updateCodeEditor(function() {
                    console.log('tab switched to code');
                });
            };

            $scope.disableSave = function() {
                return $('#id').val() === '';
            };

            function getActiveState(done) {
                $scope.modal.show('Reading metadata');
                $http.get('../scenarios/manage/' + $('#id').val() + '/activeState/')
                    .then(
                        function(response) {
                            $scope.modal.hide();
                            done(response.data);
                        },
                        function (err) {
                            $scope.modal.hide();
                            done(null, err);
                        }
                    );
            }

            $scope.runScenario = function(stepId) {
                $scope.modal.show('Running...');
                getActiveState(function(active, err) {
                    if (err) {
                        console.log(err);
                        return window.toastr.error('Run scenario failed. Try again');
                    }
                    active ? executeRun(stepId) : executionBlocked();
                });
            };

            function executeRun(stepId) {
                $scope.toggleMaxView('debug');
                setTimeout(function () {$('#watchTab').children()[0].click()}, 10);
                var trigger = $('#oldTrigger').val();
                var args = localStorageService.get('runArguments_' + trigger);
                var parsedArgs = {};
                if (args) {
                    try {
                        parsedArgs = JSON.parse(args);
                    }
                    catch(e) {
                        window.toastr.error("Run arguments are not valid")
                        return;
                    }
                }
                $scope.showRunSpinner = true;
                window.toastr.info('Running Scenario: ' + trigger + "...");
                if (stepId) {
                    parsedArgs.targetStepId = stepId;
                }

                $scope.postMessageToWebChat({
                    action:  'runScenario',
                    scenario_id: trigger,
                    args: parsedArgs
                });

                setTimeout(function() {
                    $scope.showRunSpinner = false;
                }, 5000);
            }

            function executionBlocked() {
                var modalInstance =  $uibModal.open({
                    templateUrl: '/resources/templates/activationForm.html',
                    scope: $scope,
                    controller : activationFormCtrl,
                    backdrop : "static",
                    resolve: {
                        args: function() {
                            return $scope.highliteStep;
                        }
                    }
                });
                modalInstance.result.then(function (args) {}, function () {});
            };

            var activationFormCtrl = function($scope, $uibModalInstance, $uibModal, args) {
                $scope.args = args;
                $scope.close = function () {
                    $uibModalInstance.dismiss('cancel');
                };
                $scope.tryToActivate = function () {
                    $uibModalInstance.close($scope.args);
                    $scope.modal.show('Activating...');
                    setTimeout(function() {
                        $http({
                            method: 'POST',
                            url: '../scenarios/manage/' + $('#id').val() + '/activate'
                        }).then(function successCallback(response) {
                            $scope.modal.hide();
                            if (response.status === 200) {
                                return window.toastr.success('Scenario is activated. Try running it again.');
                            } else {
                                window.toastr.error("Sorry, an error occurred while activating scenario. Please try again");
                            }
                        }, function errorCallback(response) {
                            $scope.modal.hide();
                            if (response.status === 403) {
                                return window.toastr.error(response.status + ' ' + response.statusText + ": " + response.data);
                            }
                            else if (response.status === 500) {
                                for (var issue_index = 0; issue_index < response.data.length; issue_index++) {
                                    var issue = response.data[issue_index];
                                    switch (issue.severity) {
                                        case "warning":
                                            return $window.toastr.warning(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                        case "problem":
                                            return $window.toastr.error(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                        case "error":
                                            return $window.toastr.error(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                        default:
                                            return $window.toastr.error("Sorry, an error occurred while activating scenario. Please try again");
                                    }
                                }
                            }
                            else {
                                $window.toastr.error("Sorry, an error occurred while activating scenario. Please try again");
                            }
                        });
                    }, 100);
                };
                $scope.args = args;
            };

            $scope.postMessageToWebChat = function(data) {
                $scope.logActivity();
                var iframe = $('#previewBoxFrame');
                if (iframe.length == 1) {
                    iframe[0].contentWindow.postMessage(data, "*");
                }
            };

            var argumentsFormCtrl = function($scope, $uibModalInstance, $uibModal, args) {
                $scope.logActivity();
                $scope.cancel = function () {
                    $uibModalInstance.dismiss('cancel');
                };

                $scope.ok = function () {
                    $uibModalInstance.close($scope.args);
                };

                $scope.argsHelp = "JavaScript simple value, object or array.\nObject must be a valid JSON format with keys in double qoutes.\nStrings must be in double quotes";

                $scope.args = args;

                $scope.monacoEditorOptions = {
                    language: "json"
                };
            };


            $scope.setArguments = function() {
                $scope.logActivity();
                var trigger = $('#trigger').val();
                var modalInstance =  $uibModal.open({
                    templateUrl: '/resources/templates/argumentsForm.html',
                    scope: $scope,
                    controller : argumentsFormCtrl,
                    backdrop : "static",
                    resolve: {
                        args: function() {
                            return localStorageService.get('runArguments_' + trigger)
                        }
                    }
                });
                modalInstance.result.then(function (args) {
                    localStorageService.set("runArguments_" + trigger, args)
                }, function () {
                });
            };

            $scope.createSnapshot = function() {
                $scope.modal.show('Taking snapshot...');
                $http.post('../scenarios/manage/snapshot/' + $('#id').val()).then(function(response) {
                    window.toastr.success('Snapshot Created');
                    $scope.modal.hide();
                },
                function(httpError) {
                    $scope.modal.hide();
                    window.toastr.error('Error occured while creating a snapshot');
                });
            }

            $scope.saveEditorContent = function(exitAfterSave) {
                $scope.modal.show('Validating...');
                if ($rootScope.readonly) {
                    window.toastr.error('System admin in read only mode');
                    setTimeout(function(){$scope.modal.hide()}, 100);
                    return;
                }

                const validateFunc = function(deactivatingOnProblem) {
                    getActiveState(function(deactivatingOnProblem, err) {
                        if (err) {
                            return window.toastr.error("Error while saving, please try again");
                        }
                        $scope.validateEditor(deactivatingOnProblem, function(severity){
                            var successMessage = "Scenario saved";
                            switch (severity) {
                                case 3: // error
                                    $scope.modal.hide();
                                    break;
                                case 2: // problem
                                case 1: // warning
                                    if (deactivatingOnProblem) {
                                        successMessage = "Scenario saved but deactivated";
                                        $scope.DOM.active.val("false");
                                    }
                                case 0:
                                    $scope.modal.show('Saving...');
                                    saveEditor(severity > 0, function () {
                                        window.toastr.success(successMessage);
                                        $scope.modal.hide();
                                    });
                                    break;
                                default:
                            }
                        });
                    });

                };

                if ($scope.activeTab === 1) {
                    $scope.updateCodeEditor(validateFunc);
                }
                else {
                    validateFunc();
                }
            };
            // $('#trigger').focus(function(){
            //     $('#trigger').css('border', '1px solid rgb(204, 204, 204)');
            //     $('#trigger').css('outline', 'rgb(255, 255, 255) none 0px');
            // });
            $scope.validateEditor = function(deactivatingOnProblem, done) {
                $scope.modal.show("Validating");
                $http.post("../scenarios/manage/validatescenario",
                    {
                        id:$('#id').val(),
                        name: $('#name').val(),
                        trigger: $('#trigger').val(),
                        code: $scope.editorScope.editor,
                        justLoaded: $scope.justLoaded
                    })
                .then(
                    function(response) {
                        var severity  = 0;
                        response.data.forEach(function (issue) {
                            switch (issue.severity) {
                                case "warning":
                                    if (deactivatingOnProblem) {
                                        issue.text += "<br><b>Deactivating scenario<b>";
                                    }
                                    window.toastr.warning(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                    severity = Math.max(severity, 1);
                                    break;
                                case "problem":
                                    if (deactivatingOnProblem) {
                                        issue.text += "<br><b>Deactivating scenario<b>";
                                    }
                                    window.toastr.error(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                    severity = Math.max(severity, 2);
                                    break;
                                case "error":
                                    window.toastr.error(issue.text, null, {timeOut: 0, extendedTimeOut: 0, closeButton: true});
                                    // if (issue.text === 'Illegal scenario trigger. Remove all spaces and save again') {
                                    //     $('#trigger').css('border', '2px solid rgb(255, 0, 0)');
                                    //     $('#trigger').css('outline', 'rgb(255, 255, 255) solid 1px');
                                    // }
                                    severity = Math.max(severity, 3);
                                    break;
                            }
                            if (issue.stepId) {
                                setTimeout(function() {
                                    var step = $('#' + issue.stepId);
                                    $scope.highliteStep(step);
                                }, 500)
                            }
                        });
                        $scope.modal.hide();
                        done(severity);
                    },
                    function() {
                        $scope.modal.hide();
                        window.toastr.error('Error occurred while validating. please try again');
                    }
                );
                $scope.justLoaded = false;
            };

            function saveEditor(deactivate, done) {
                // var isSub = $.url().param('sub') == 'true' ? true : false;
                var codeObject = JSON.parse($scope.editorScope.editor);
                $http.put(window.location.href,
                    {
                        code: JSON.stringify(codeObject),
                        deactivate: deactivate !== undefined ? deactivate : false
                    })
                .then(
                    function(response) {
                        if (response.status === 200 || response.status === 201) {
                            updateLastModified();
                            done();
                        } else {
                            window.toastr.error(response.statusText + " : " + response.data);
                            $scope.modal.hide();
                        }
                    },
                    function() {
                        window.toastr.error('Error occurred while saving. please try again');
                        $scope.modal.hide();
                    }
                );
            };

            $scope.updateCodeEditor = function(callback) {
                $scope.logActivity();
                if (!$scope.editorScope) {
                    return;
                }
                var code;
                try {
                    code = JSON.parse($scope.editorScope.editor);
                } catch(err) {
                    return;
                }
                code.steps=[];
                var windows = $('.window', $scope.canvas);
                var firstWindow = $('.window.first-element', $scope.canvas);
                if (firstWindow.length === 1) {
                    code.steps.push($(firstWindow).data('element'));
                }
                windows = $.grep(windows, function (value) {
                    return $(value).attr('id') !== firstWindow.attr('id');
                });
                if (windows.length === 0) {
                    $scope.editorScope.editor = JSON.stringify(code, null, '  ');
                    callback();
                } else {
                    $.each(windows, function (index, value) {
                        var step = $(value).data('element');
                        code.steps.push(step);
                        if (index === windows.length - 1) {
                            $scope.editorScope.editor = JSON.stringify(code, null, '  ');
                            callback();
                        }
                    });
                }
            };
            $scope.toggleMinimap = function() {
                $scope.logActivity();
                toolboxes.minimap = !toolboxes.minimap;
                toolboxes.toggleMinimap($scope.designer);
            };

            $scope.designerTabSelected = function() {
                $scope.logActivity();
                setTimeout(function() {
                    $('.mgNavigator').remove();
                    var editorScope = angular.element($('#codeTab')).scope();
                    if (toolboxes.minimap) {
                        toolboxes.displayMinimap($scope.designer);

                    }
                    $scope.modal.show('Validating...');
                    $scope.canvas.empty();
                    $scope.canvas.append($('<div>').attr('id','rubberband'));
                    var srcCode = editorScope.editor;
                    var code = JSON.parse(srcCode);
                    angular.forEach(code.steps, function(step, key){
                        var $window = addStep($scope.canvas, step);
                        if (key === 0) {
                            $window.addClass('first-element');
                        }
                    });

                    $compile($scope.canvas)($scope.newScope);
                    $('.window', $scope.canvas).each(function() {
                        var step = $(this).data('element');
                        constants[step.type].connectStep(instance, $(this), step);
                    });
                    $scope.designer.mgMiniMap('update');
                    $scope.updateSearchables();
                    $scope.$apply();
                    $scope.modal.hide();
                },0);
                // Connect all the windows
            };
            $scope.updateSearchables = function() {
                $scope.allSearchables = [];
                $('.window', $scope.canvas).each(function() {
                    var step = $(this).data('element');
                    $scope.allSearchables.push($scope.getStepCaption(step.id));
                });
                $scope.variables = $autocomplete.variables($('.window', $scope.canvas));
            };

            instance.bind("connection", function (info) {
                var srcElement = $(info.source).data('element');
                constants[srcElement.type].makeConnection(srcElement, info);
            });

            instance.bind("connectionDetached", function (info) {
                var srcElement = $(info.source).data('element');
                constants[srcElement.type].detachConnection(srcElement, info);
            });


            function buildElement(type, ui) {
                var id = $guid.guid();
                if (constants[type]) {
                    var newElement = constants[type].getNewElement(id, ui.position);
                    return newElement;
                }
                return null;
            }

            function buildElementUI(parent, element) {
                var uiElement = $('<div>')
                    .addClass('window')
                    .addClass('hasmenu')
                    .attr('id', element.id)
                    .css('top', (element.designer) ? element.designer.yLocation + "px" : "0px")
                    .css('left', (element.designer) ? element.designer.xLocation + "px" : "0px")
                    .attr('ng-dblclick', "doubleClick($event)")
                    .attr('ng-mousedown', "mouseDown($event)")
                    .attr('title', "{{getStepCaption('" + element.id + "')}}");

                constants[element.type].addCustomData(uiElement);

                uiElement.append($('<div>').addClass('steplabel').html("{{getStepCaption('" + element.id + "')}}"));

                uiElement.addClass(constants[element.type].getClass());

                uiElement.tooltip({ container: 'body', placement: 'bottom' });

                uiElement.append($('<div>').addClass('ep'));
                $scope.canvas.append(uiElement);
                uiElement.data('element', element);

                return uiElement;
            }

            function addStep(parent, element) {
                var uiElement = buildElementUI(parent, element);
                instance.draggable(jsPlumb.getSelector(".window"), {
                    allowNegative : false,
                    grid: [20, 20],
                    start: function (params) {
                        startPos = params.pos;
                        $scope.logActivity();
                    },
                    drag: function (params) {
                    },
                    stop: function (params) {
                        var step = $(params.el).data('element');
                        step.designer.xLocation = params.finalPos[0];
                        step.designer.yLocation = params.finalPos[1];
                        $scope.designer.mgMiniMap('update');
                        $(params.el).ScrollTo({onlyIfOutside: true});
                    }
                });
                constants[element.type].addEndpoints(instance, element);
                return uiElement;
            };

            /**
             * remove the element from canvas and update everything
             */
            var removeElement = function($window) {
                $scope.logActivity();
                instance.detachAllConnections($window);
                instance.removeAllEndpoints($window);
                $window.remove();
                $scope.designer.mgMiniMap('update');;
                $scope.updateSearchables();
                $scope.newScope.$destroy(); // destroy the scope and all child scopes
                $scope.newScope = $scope.$new();
                $compile($scope.canvas)($scope.newScope);
            };

            var buildEditor = function() {

                $scope.canvas = $('#canvas');
                $scope.designer = $('#designer');

                function dragZoomFixer(evt,ui) {
                    var zoom = $scope.currentZoom / 100;
                    var canvas = $('#canvas');
                    ui.position.top = Math.round(ui.position.top / zoom);
                    ui.position.left = Math.round(ui.position.left / zoom);
                }

                $(".drag").draggable({
                    drag: dragZoomFixer,
                    appendTo: $scope.canvas,
                    helper: "clone",
                    grid: [20, 20],
                    scroll:true,
                    scrollSensitivity: 1,
                    scrollSpeed : 10,
                    snap: true
                });

                $scope.designer.droppable({
                    drop: function (event, ui) {
                        $scope.logActivity();
                        var type = ui.draggable.attr('id');
                        var newElement = buildElement(type, ui);
                        if (newElement) {
                            var $window = addStep($scope.canvas, newElement);
                            if ($('.window').length == 1) {
                                $window.addClass('first-element');
                            }
                            $compile($window)($scope.newScope);
                            $scope.editWindow($window, true /*just added*/);
                            $scope.$apply();

                            $scope.designer.mgMiniMap('update');

                        }
                    }
                });


                $(document).contextmenu(
                    {
                        delegate: ".hasmenu",
                        preventContextMenuForPopup: true,
                        preventSelect: true,
                        taphold: true,
                        menu: [
                            {title: "Make Start Step", cmd: "makeStart", uiIcon: "ui-icon-arrowthick-1-s"},
                            {title: "Run from here", cmd: "runFromHere", uiIcon: "ui-icon-play"},
                            {title: "Edit Step", cmd: "editElement", uiIcon: "ui-icon-pencil"},
                            {title: "Remove", cmd: "removeElement", uiIcon: "ui-icon-trash"},
                            {title: "Flip Step Sides", cmd: "switchYesNo", uiIcon: "ui-icon-arrow-2-e-w"},
                            {title: "Clone", cmd: "cloneElement", uiIcon: "ui-icon-copy"},
                            {title: "Select All", cmd: "selectAll", uiIcon: "ui-icon-newwin"}
                        ],
                        beforeOpen : function(e, ui) {
                            var $target = ui.target;
                            if ($target.is('span')) {
                                $target = $target.parent();
                            }
                            var $window = $target.closest('.window');
                            var step = $window.data('element');

                            if (constants[step.type].canSwitchSides()) {
                                $('li[data-command="switchYesNo"]').show();
                            }
                            else {
                                $('li[data-command="switchYesNo"]').hide();
                            }
                        },
                        select: function (e, ui) {
                            $scope.logActivity();
                            var $target = ui.target;
                            if ($target.is('span')) {
                                $target = $target.parent();
                            }
                            switch (ui.cmd) {
                                case "makeStart":
                                    $('.window', $scope.canvas).each(function () {
                                        $(this).removeClass('first-element');
                                    });
                                    var $window = $target.closest('.window');
                                    $window.addClass('first-element');
                                    break;
                                case "runFromHere":
                                    var $window = $target.closest('.window');
                                    var step = $window.data('element');
                                    $scope.runScenario(step.id);
                                    break;
                                case "editElement":
                                    var $window = $target.closest('.window');
                                    $scope.editWindow($window);
                                    break;
                                case "removeElement" :
                                    var $window = $target.closest('.window');
                                    removeElement($window);
                                    break;
                                case "switchYesNo":
                                    var $window = $target.closest('.window');
                                    var step = $window.data('element');
                                    // Copy element
                                    var tempElement =  window.angular.copy(step);
                                    // unlink
                                    instance.deleteEndpoint(step.id+"-no");
                                    instance.deleteEndpoint(step.id+"-yes");
                                    instance.deleteEndpoint(step.id+"-fail");
                                    // restore
                                    window.angular.copy(tempElement, step);
                                    // toggle sided
                                    step.designer.reverse = !step.designer.reverse;
                                    // Add new points
                                    constants[step.type].addEndpoints(instance, step);
                                    // reconnect
                                    constants[step.type].connectStep(instance, $window, step);
                                    break;
                                case "cloneElement" :
                                    var $window = $target.closest('.window');
                                    var step = $window.data('element');
                                    cloneElement(step);
                                    break;
                                case "selectAll":
                                    $(".window").each(function(i, el) {
                                        instance.addToDragSelection(el);
                                    });
                                    break;
                            }
                        }
                    }
                );
            };

            function cloneElement(step) {
                if (!step) {
                    return;
                }
                var clonedElement =  window.angular.copy(step);
                clonedElement.designer.xLocation = step.designer.xLocation + 50;
                clonedElement.designer.yLocation = step.designer.yLocation + 50;
                clonedElement.designer.next = undefined;
                clonedElement.targetStepId = undefined;
                clonedElement.id = $guid.guid();
                var $window = addStep($scope.canvas, clonedElement);
                $compile($window)($scope.newScope);
                $scope.$apply();
                return clonedElement.id;
            }

            // Entry point to this controller - Get here when page is loaded
            angular.element(document).ready(function () {
                buildEditor();
                $scope.showRunSpinner = false;

                window.addEventListener("message", function(event) {
                    if (event.type === "message" && event.data.type === "event" && event.data.name === "debugContext") {
                        $scope.renderDebugContext(event.data.value);
                        $scope.showRunSpinner = false;
                    }
                    if (event.type === "message" && event.data.type === "event" && event.data.name === "evaluateExpressrionResult") {
                        $scope.renderDebugContext(event.data.value);
                        $scope.evalResults = JSON.stringify(event.data.value.evaluatedResult, undefined, ' ');
                        $scope.showEvalSpinner = false;
                        $scope.$apply();
                    }
                });

                // Notify the server that this scenario is beeing edited
                $scope.enterEditor();

                var debugSession = localStorageService.get('debugsession') || ("debugger_" + $guid.guid());

                localStorageService.set('debugsession', debugSession);
                setTimeout(function () {
                    $http.get('../getDebugSessionJwt?debugSessionId=' + debugSession)
                        .then(
                            function(response) {
                                $http.get('../webchatToken').then(function(tokenResponse) {
                                    $http.get('../language-models/localization/locales').then(function(localesResponse) {
                                        $scope.webchat_locales = localesResponse.data;
                                        $scope.webchat_locale.selected = "en-us";
                                        $scope.webchatUrl = $sce.trustAsResourceUrl("/resources/webchat/index.html" + "?t=" + tokenResponse.data + "&locale=" + $scope.webchat_locale.selected + "&userId=" + debugSession +
                                            "&event=" + "InitAuthenticatedConversation" + "&eventValue=" + response.data + "&domain=" + $('#directlineDomain').val());
                                    }, function(err) {
                                        window.toastr.error("Sorry, an error occurred. Please try again");
                                    });

                                }, function(err) {
                                    window.toastr.error("Sorry, an error occurred. Please try again");
                                });
                                setTimeout(function() {
                                    $scope.$apply();
                                }, 50);
                            },
                            function(err) {
                                window.toastr.error('Unexpected error occurred. please refresh this page');
                                console.log(err);
                            }

                        );
                }, 500);

                readLocalizationSettings();
                readLocalizedStrings();

                $scope.snippets = [];

                $http.get('../scenarios/manage/all?builtin=true')
                    .then(
                        function(response) {
                            $scope.scenarios = response;
                        },
                        function(err) {
                            window.toastr.error('Unexpected error occurred. please refresh this page');
                            console.log(err);
                        }
                    );
                $http.get('../resources/files/all')
                    .then(
                        function(response) {
                            $scope.blobs = response;
                        },
                        function(err) {
                            window.toastr.error('Unexpected error occurred. please refresh this page');
                            console.log(err);
                        }
                    );

                $scope.currentZoom = localStorageService.get('zoom') || 100;
                window.setZoom($scope.currentZoom/100, instance, $scope.canvas[0]);

                $scope.editorScope = angular.element($('#codeTab')).scope();
                var editorScopeRef = $scope.editorScope;
                $http.get('./' + $('#id').val() + '/code')
                    .then(
                        function(response) {

                            $('#active').val(response.data.metadata.active);
                            $('#oldTrigger').val(response.data.metadata.scenario_trigger);
                            $('#trigger').val(response.data.metadata.scenario_trigger);
                            $('#name').val(response.data.metadata.name);
                            $('#description').val(response.data.metadata.description);
                            $('#titleScenarioName').text(response.data.metadata.name);
                            $('#lastModified').text(response.data.metadata.lastModified);
                            $('#infoName').attr("title", response.data.metadata.name);
                            $('#infoName').text(response.data.metadata.name);
                            $('#infoTrigger').attr("title", response.data.metadata.scenario_trigger);
                            $('#infoTrigger').text(response.data.metadata.scenario_trigger);
                            $('#infoDescription').attr("title", response.data.metadata.description);
                            $('#infoDescription').text(response.data.metadata.description);
                            $('#infoBreaking').attr("title", response.data.code.breaking ? 'Enabled' : 'Disabled');
                            $('#infoBreaking').text(response.data.code.breaking ? 'Enabled' : 'Disabled');
                            $('#infoInterrupting').attr("title", response.data.code.interrupting ? 'Enabled' : 'Disabled');
                            $('#infoInterrupting').text(response.data.code.interrupting ? 'Enabled' : 'Disabled');

                            if (response.data.code.returningMessage && response.data.code.returningMessage.stringId) {
                                $('#infoReturningMessage').attr("title", response.data.code.returningMessage['en-us']);
                                $('#infoReturningMessage').text(response.data.code.returningMessage['en-us']);
                            } else {
                                $('#infoReturningMessage').attr("title", response.data.code.returningMessage);
                                $('#infoReturningMessage').text(response.data.code.returningMessage);
                            }

                            editorScopeRef.editor = response.data.code;
                            try {
                                editorScopeRef.editor = JSON.stringify(editorScopeRef.editor);
                                $("#editorinitialcontent").val(editorScopeRef.editor);
                            }
                            catch(err) {

                            }
                            $scope.showDesignerTab = true;
                            $scope.activeTab = 0;

                            $scope.validateAndSelectDesigner();
                        },
                        function(err) {
                            window.toastr.error('Error occurred while reading scenario content, please try to reload the page.');
                            console.log(err);
                            $scope.modal.hide();
                        }
                    );
            });

            $scope.validateAndSelectDesigner = function() {
                // if we are in the code tab (i.e. on page start), we need to first verify the json structure, then send to server.
                if ($scope.activeTab === 0) {
                    if (jsonFormatValidation()) {
                        $scope.modal.show('Validating...');
                        $scope.validateEditor(false, function(severity) {
                            $scope.modal.hide();
                            if (severity < 3) {
                                setTimeout(function() {
                                    $scope.activeTab = 1;
                                    $scope.$apply();
                                    $scope.designerTabSelected();
                                }, 10);
                            } else {
                                hardSwitchToCodeTab();
                            }
                        });
                    } else {
                        hardSwitchToCodeTab();
                    }
                }
            };

            function hardSwitchToCodeTab() {
                setTimeout(function() {
                    $scope.activeTab = 0;
                    $scope.$apply();
                }, 10)
            }

            function jsonFormatValidation() {
                try {
                    JSON.parse($scope.editorScope.editor);
                    return true;
                } catch (err) {
                    window.toastr.error(err);
                    return false;
                }
            }

            function extractDebugContext(array) {
                if (array) {
                    for (var i = 0; i < array.length; i++) {
                        if (array[i].hasOwnProperty("debugContext")) {
                            return array[i].debugContext;
                        }
                    }
                }
                return null;
            }

            $scope.renderDebugContext = function(dc) {
                if (!dc || !dc.data) {
                    return;
                }
                $scope.debugcontext = dc.data;

                try {
                    // Collect all the variable names that can be evaluated
                    var dialogPath = $scope.getDialogPath($scope.debugcontext.scenarioStack);
                    $scope.variablesOnly = [];
                    Object.keys($scope.debugcontext.user).forEach(function(u) {
                        $scope.variablesOnly.push('user.' + u);
                    });
                    Object.keys($scope.debugcontext.conversation).forEach(function(c) {
                        $scope.variablesOnly.push('conversation.' + c);
                    });
                    var dialogVars = eval('$scope.debugcontext.conversation.' + dialogPath);
                    Object.keys(dialogVars).forEach(function(s) {
                        $scope.variablesOnly.push('scenario.' + s);
                    });
                }
                catch(err) {
                    console.log(err);
                }


                // Hihhlight the current message
                if (dc.stepId) {
                    $('.window', $scope.canvas).each(function() {
                        $(this).removeClass('current-step');
                    });
                    var window = $("#" + dc.stepId);
                    window.ScrollTo({onlyIfOutside: false});
                    var blinkInterval = setInterval(function(){
                        window.toggleClass('current-step');
                    }, 70);
                    setTimeout(function() {
                        clearInterval(blinkInterval);
                        $('.window', $scope.canvas).each(function() {
                            $(this).removeClass('current-step');
                        });
                        window.addClass('current-step');
                    }, 1000);
                }
                // Add trace messages
                if (dc.traceMessages) {
                    for (var i = 0 ; i < dc.traceMessages.length; i++) {
                        var tm = dc.traceMessages[i];
                        $scope.debugMessages = [{
                            timestamp: '' + new Date(tm.timestamp).toISOString(),
                            message: tm.message,
                            levelClass: $scope.messageLevelToClass(tm.level)
                        }].concat($scope.debugMessages);
                        $('.trace-messages-rows').scrollTop(0);

                    }
                }
                $scope.$apply();
            };

            $scope.clearDebugMessages = function() {
                $scope.debugMessages.splice(0, $scope.debugMessages.length);
            };

            $scope.messageLevelToClass = function(level) {
                switch(level) {
                    case 0:
                        return "bg-success";
                    case 1:
                        return "bg-info";
                    case 2:
                        return "bg-warning";
                    case 3:
                        return "bg-danger";
                }
            };

            $scope.doubleClick = function($event) {
                $scope.logActivity();
                $scope.editWindow($($event.currentTarget));
            };

            $scope.startPoint = {};

            $scope.canvasMouseDown = function ($event) {
                if ($event.which !== 1) { return; }
                instance.clearDragSelection();
                var zoom = $scope.currentZoom / 100;
                var offset = $scope.getTopLeftOffset($scope.canvas);
                offset.top-= $scope.canvas.scrollTop();
                offset.left-=$scope.canvas.scrollLeft();
                $scope.startPoint.x = ($event.clientX - offset.left) / zoom;
                $scope.startPoint.y = ($event.clientY - offset.top) / zoom;

                $("#rubberband").css({top:$scope.startPoint.y, left:$scope.startPoint.x, height:1, width:1});
                $("#rubberband").show();
            };

            $scope.canvasMouseMove = function($event) {
                if($("#rubberband").is(":visible") !== true) { return; }
                var zoom = $scope.currentZoom / 100;

                var x1 = $scope.startPoint.x;
                var y1 = $scope.startPoint.y;
                var offset = $scope.getTopLeftOffset($scope.canvas);
                offset.top-= $scope.canvas.scrollTop();
                offset.left-=$scope.canvas.scrollLeft();

                var x2 = ($event.clientX - offset.left) / zoom;
                var y2 = ($event.clientY - offset.top) / zoom;

                var l = Math.min(x1,x2);
                var t = Math.min(y1,y2);
                var w = Math.abs(x1-x2);
                var h = Math.abs(y1-y2);
                $("#rubberband").css({top:t, left:l, height:h, width:w});
            };

            $scope.canvasMouseUp = function ($event) {
                $scope.findSelectedItem();
                $("#rubberband").hide();
            };

            $scope.findSelectedItem = function() {
                if($("#rubberband").is(":visible") !== true) { return; }

                var rubberbandOffset = $scope.getTopLeftOffset($("#rubberband"));

                $(".window").each(function(i, el) {
                    var itemOffset = $scope.getTopLeftOffset($(this));
                    var middleH =  (itemOffset.bottom - itemOffset.top) / 2;
                    var middleW = (itemOffset.right - itemOffset.left)  / 2;
                    if( itemOffset.top + middleH     > rubberbandOffset.top &&
                        itemOffset.left + middleW    > rubberbandOffset.left &&
                        itemOffset.right - middleW   < rubberbandOffset.right &&
                        itemOffset.bottom - middleH  < rubberbandOffset.bottom) {
                        instance.addToDragSelection(el);
                    }
                });
            };

            $scope.getTopLeftOffset = function (element) {
                var elementDimension = {};
                elementDimension.left = element.offset().left;
                elementDimension.top =  element.offset().top;
                elementDimension.right = elementDimension.left + element.outerWidth();
                elementDimension.bottom = elementDimension.top + element.outerHeight();
                return elementDimension;
            };

            $scope.mouseDown = function($event) {
                var w = $event.currentTarget;
                if ($event.button != 0) {
                    return;
                }
                if ($event.ctrlKey) {
                    if ($(w).hasClass('jsplumb-drag-selected')) {
                        instance.removeFromDragSelection(w)
                    }
                    else {
                        instance.addToDragSelection(w);
                    }
                }
                else {
                    if ($(w).hasClass('jsplumb-drag-selected') == false) {
                        instance.clearDragSelection();
                    }
                    instance.addToDragSelection(w);
                }
                $event.stopPropagation();
            };

            $scope.onSearchSelected = function($item, $model, $label) {
                $('.window', $scope.canvas).each(function() {
                    if ($scope.getStepCaption($(this).attr('id')) == $item) {
                        $scope.highliteStep($(this));
                    }
                })
            };

            $scope.highliteStep = function(window) {
                window.ScrollTo({onlyIfOutside: false});
                var blinkInterval = setInterval(function(){
                    window.toggleClass('found-element');
                }, 70);
                setTimeout(function(){
                    clearInterval(blinkInterval);
                    $('#searchbox').val('');
                }, 1000)
            };

            $scope.debugcontext = "N/A";


            $scope.debugMessages = [];

            var zoom = {
                step: 5,
                max: 500,
                min: 10
            };
            $scope.zoomout = function() {
                if ($scope.currentZoom > zoom.min) {
                    $scope.currentZoom-=zoom.step;
                    window.setZoom($scope.currentZoom / 100, instance, $scope.canvas[0]);
                    localStorageService.set('zoom', $scope.currentZoom);
                    $scope.designer.mgMiniMap('update');
                }
            };

            $scope.zoomin = function() {
                if ($scope.currentZoom < zoom.max) {
                    $scope.currentZoom+=zoom.step;
                    window.setZoom($scope.currentZoom / 100, instance, $scope.canvas[0]);
                    localStorageService.set('zoom', $scope.currentZoom);
                    $scope.designer.mgMiniMap('update');
                }
            };

            $scope.zoomoutmouse = function(e) {
                if ($scope.currentZoom > zoom.min) {
                    $scope.currentZoom-=zoom.step;
                    window.setZoom($scope.currentZoom / 100, instance, $scope.canvas[0]);
                    localStorageService.set('zoom', $scope.currentZoom);
                    $scope.designer.mgMiniMap('update');
                }
            };

            $scope.zoominmouse = function(e) {
                if ($scope.currentZoom < zoom.max) {
                    $scope.currentZoom+=zoom.step;
                    window.setZoom($scope.currentZoom / 100, instance, $scope.canvas[0]);
                    localStorageService.set('zoom', $scope.currentZoom);
                    $scope.designer.mgMiniMap('update');
                }
            };

            $scope.getStepCaption = function(id){
                var step = $('#'+id).data('element');
                if (!step) {
                    return "";
                }
                return constants[step.type].text(step);
            };

            $scope.getScenarioData = function() {
                if ($scope.editorScope) {
                    try {
                        var j = JSON.parse($scope.editorScope.editor);
                        return 'data:Application/text,' + JSON.stringify(j,' ');
                    }
                    catch (err) {
                        return "";
                    }
                }
                return "";
            };

            $scope.getFileName = function() {
                if ($scope.scenarioName) {
                    return $scope.scenarioName + ".json";
                }
                return "";
            };

            $scope.showPreviewBox = function() {
                return $('#webchat_secret').val() != '';
            };

            $scope.editWindow = function($window, justadded) {
                var step = $window.data("element");
                $scope.uibCtrl = {};
                $scope.uibCtrl._labledTitle_ = step.label && step.label !== "";
                $scope.uibCtrl._defaultTitle = constants[step.type].getCaption();
                $scope.uibCtrl._activateLabeledTitle = function(element, title) {
                    console.log("_activateLabeledTitle ")
                    this._labledTitle_ = true;
                    element.label = title;
                    setTimeout(function() {
                        try {
                            $('#label-input-box').trigger("focus");
                        }
                        catch (err) {
                        }
                    }, 50);
                };
                $scope.uibCtrl._disableLabeledTitle = function(element) {
                    console.log("_disableLabeledTitle ")
                    this._labledTitle_ = false;
                    element.label = "";
                };

                var template = constants[step.type].getTemplate();

                var modalInstance =  $uibModal.open({
                    templateUrl: template,
                    size : 'lg',
                    scope: $scope,
                    controller : constants[step.type].getElementFormCtrl(),
                    windowClass: "hb-modal-step-" + step.type,
                    backdrop : "static",
                    resolve : {
                        element : function() {
                            return step;
                        },
                        windows : function () {
                            return $('.window', $scope.canvas);
                        },
                        snippets : function() {
                            return $scope.snippets;
                        },
                        scenarios : function() {
                            return $scope.scenarios;
                        },
                        blobs : function() {
                            return $scope.blobs;
                        },
                        loclizationSettings : function() {
                            return $scope.localizationSettings;
                        },
                        existingLocalizationStrings : function() {
                            return $scope.existingLocalizationStrings;
                        }
                    }
                });
                modalInstance.justadded = justadded;

                modalInstance.result.then(function (tempElement) {
                    constants[step.type].postEditOK(instance, step, tempElement);
                    window.angular.copy(tempElement, step);
                    $scope.updateSearchables();
                }, function () {
                    constants[step.type].postEditCancel(instance, step);
                    // If cancel just after adding new element, remove the element from canvas
                    if (modalInstance.justadded) {
                        removeElement($window);
                    }
                });
            };
            $scope.currentOpenedDrawer = "";
            $scope.drawer = {
                open: function(id) {
                    $scope.logActivity();
                    if ($('#' + id).hasClass("drawer-opened")) {
                        $scope.drawer.close(id);
                    }
                    else {
                        $scope.currentOpenedDrawer = id;
                        $('.drawer').removeClass('drawer-opened');
                        $('#' + id).addClass('drawer-opened');
                        ['#main-editor', '#right-pane', '#trace-window', '.mgNavigator'].forEach(function(item) { $(item).addClass('frozen') });
                    }
                },
                close: function(id) {
                    $scope.logActivity();
                    $scope.currentOpenedDrawer = "";
                    $('#' + id).removeClass('drawer-opened');
                    ['#main-editor', '#right-pane', '#trace-window', '.mgNavigator'].forEach(function(item) { $(item).removeClass('frozen') });
                },
            };

            $rootScope.openDrawer = $scope.drawer.open;
            $rootScope.closeDrawer = $scope.drawer.close;

            $scope.selectTab = function(id) {
                setTimeout(function () {$('#' + id).children()[0].click()}, 10);
            };

            $scope.maxView = localStorageService.get('healthbot_editorMaxView');
            $scope.toggleMaxView = function (mode) {
                if (mode === 'debug') {
                    $scope.maxView = false;
                } else {
                    $scope.maxView = !$scope.maxView;
                }
                localStorageService.set('healthbot_editorMaxView', $scope.maxView);
                setTimeout(toolboxes.updateMgNavigatorPosition, 10);
            };

            $scope.toCopy = [];

            $scope.changeWebChatLocale = function() {
                var debugSession = localStorageService.get('debugsession') || ("debugger_" + $guid.guid());

                $http.get('../getDebugSessionJwt?debugSessionId=' + debugSession)
                    .then(
                        function(response) {
                            $http.get('../webchatToken').then(function(tokenResponse) {
                                $scope.webchatUrl = $sce.trustAsResourceUrl("/resources/webchat/index.html" + "?t=" + tokenResponse.data + "&locale=" + $scope.webchat_locale.selected + "&userId=" + debugSession +
                                    "&event=" + "InitAuthenticatedConversation" + "&eventValue=" + response.data);
                            }, function(err) {
                                window.toastr.error("Sorry, an error occurred. Please try again");
                            });
                        },
                        function(err) {
                            window.toastr.error('Unexpected error occurred. please try again');
                            console.log(err);
                        }

                    );
            };

            $(document).on("keydown", function(e){
                if (($('.modal.in').length > 0) || ($('.spinner').css('display') !== "none")) {
                    return;
                }
                var evtobj=window.event? event : e;
                if(evtobj.ctrlKey && e.keyCode === 70) { // "ctrl + f"
                    $('#searchbox').trigger("focus");
                    blink('searchbox', 95, 3);
                    return false;
                }
                if(evtobj.ctrlKey && e.keyCode === 83) { // "ctrl + s"
                    $('#saveButton').trigger("click");
                    return false;
                }
                if(evtobj.ctrlKey && e.keyCode === 82) { // "ctrl + r"
                    $('#runButton').trigger("click");
                    return false;
                }
                if(evtobj.ctrlKey && e.keyCode === 65) { // "ctrl + a"
                    $(".window").each(function(i, el) {
                        window.jsp.addToDragSelection(el)
                    });
                    return false;
                }
                if (evtobj.ctrlKey && e.keyCode === 67) { // ctrl + c
                    $scope.toCopy = [];
                    $(".jsplumb-drag-selected").each(function(i, el) {
                        $scope.toCopy.push(el.id);
                    });
                }
                if (evtobj.ctrlKey && e.keyCode === 86) { // ctrl + v
                    window.jsp.clearDragSelection();
                    var addedIds = [];
                    $scope.toCopy.forEach(function (id) {
                        var id = cloneElement($("#" + id).data("element"));
                        if (id) {
                            addedIds.push(id);
                        }
                    });
                    addedIds.forEach(function(id) {
                        window.jsp.addToDragSelection($('#' + id)[0]);
                    })

                }

                if(evtobj.altKey && e.keyCode === 49) { // "alt + 1"
                    $('#codeTabSelector').trigger("click");
                    return false;
                }
                if(evtobj.altKey && e.keyCode === 50) { // "alt + 2"
                    $('#designerTabSelector').trigger("click");
                    return false;
                }
            });
            function blink(id, rate, i) {
                var originalBorder = $('#' + id).css('border');
                var blinkedBorder = '2px solid #0071c6';
                function blinkOn() {
                    $('#' + id).css('border', blinkedBorder);
                    setTimeout(blinkOff, rate);
                }
                function blinkOff() {
                    i--;
                    $('#' + id).css('border', originalBorder);
                    if (i > 0) {
                        setTimeout(blinkOn, rate);
                    }
                }
                blinkOn();
            }
        });
})();
