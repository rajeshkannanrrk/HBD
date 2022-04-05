// copied from units/ui/MonacoEditor.html

angular.module('scenarioEditorApp.directives')
    .directive('uiMonacoeditor', function ($timeout, uiMonacoeditorConfig) {
        var disposableFhirLib;
        var provider = {
        };

        require(["vs/editor/editor.main"], function () {
            monaco.languages.registerCompletionItemProvider('javascript', provider);
        });

        return {
            restrict: 'EA',
            require: '?ngModel',
            compile: function compile() {
                // Omit checking "Require MonacoEditor"
                return postLink;
            }
        };


        function postLink(scope, iElement, iAttrs, ngModel) {
            require(["vs/editor/editor.main"], function () {
                var monacoeditorOptions = angular.extend(
                    { value: iElement.text() },
                    uiMonacoeditorConfig.monacoeditor || {},
                    scope.$eval(iAttrs.uiMonacoeditor),
                    scope.$eval(iAttrs.uiMonacoeditorOpts)
                )

                var monacoeditor = newMonacoeditorEditor(iElement, monacoeditorOptions);

                configOptionsWatcher(
                    monacoeditor,
                    iAttrs.uiMonacoeditor || iAttrs.uiMonacoeditorOpts,
                    scope
                );

                configNgModelLink(monacoeditor, ngModel, scope);

                // {to do}: add configUiRefreshAttribute
                // {to do}: add broadcasted event

                configAutoCompleteAttribute(monacoeditor, iAttrs.autocomplete, scope);

                configUiRefreshAttribute(monacoeditor, ngModel, iAttrs.uiRefresh, scope);

                configureOnEnterAttribute(monacoeditor, iAttrs.onenter, scope);

                // onLoad callback
                if (angular.isFunction(monacoeditorOptions.onLoad)) {
                    monacoeditorOptions.onLoad(monacoeditor)
                }
            })
        }

        function newMonacoeditorEditor(iElement, monacoeditorOptions) {
            var editor = monaco.editor.create(iElement[0], {
                language: monacoeditorOptions.language,
                lineNumbers: monacoeditorOptions.lineNumbers,
                wordWrap: 'off',
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                scrollbar: monacoeditorOptions.scrollbar,
                renderLineHighlight: "none",
                readOnly: monacoeditorOptions.readOnly,
                glyphMargin: monacoeditorOptions.glyphMargin
            });
            if (monacoeditorOptions.actions) {
                for (var i=0; i < monacoeditorOptions.actions.length; i++) {
                    editor.addAction(monacoeditorOptions.actions[i]);
                }
            }
            if (monacoeditorOptions.fhir && monacoeditorOptions.fhir.def) {
                if (disposableFhirLib) {
                    disposableFhirLib.dispose();
                }
                var res = monacoeditorOptions.fhir.def.join('\n');
                if (monacoeditorOptions.fhir.name && monacoeditorOptions.fhir.name.length > 0) {
                    res += '\n function FHIR(x:I' + monacoeditorOptions.fhir.name + '):I' + monacoeditorOptions.fhir.name + '\n';
                }
                disposableFhirLib = monaco.languages.typescript.javascriptDefaults.addExtraLib(res, 'filename/fhir.d.ts');
            }
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES6,
                allowNonTsExtensions: false
            });

            return editor
        }

        function configOptionsWatcher(monacoeditor, uiMonacoeditorAttr, scope, monacoeditorDefaultsKeys) {
            if (!uiMonacoeditorAttr) { return; }

            // var monacoeditorDefaultsKeys = Object.keys(window.MonacoEditor.defaults);
            // {to do}: https://microsoft.github.io/monaco-editor/api/interfaces/monaco.editor.ieditorconstructionoptions.html
            var monacoeditorDefaultsKeys = monacoeditorDefaultsKeys || ["language", "lineNumbers", "fhir"];
            scope.$watch(uiMonacoeditorAttr, updateOptions, true)
            function updateOptions(newValues, oldValues) {
                if (!angular.isObject(newValues)) { return; }
                monacoeditorDefaultsKeys.forEach(function (key) {
                    if (newValues.hasOwnProperty(key)) {
                        if (oldValues && newValues[key] === oldValues[key]) {
                            return
                        }
                        // {to do}: should write something more general; monacoeditor.updateOptions(key, newValues[key])
                        switch (key) {
                            case "lineNumbers":
                                monacoeditor.updateOptions({ "lineNumbers": newValues[key] });
                                break;
                            case "language":
                                monaco.editor.setModelLanguage(monacoeditor.getModel(), newValues[key]);
                                break;
                            case "fhir":
                                if (disposableFhirLib) {
                                    disposableFhirLib.dispose();
                                }
                                var res = newValues.fhir.def.join('\n');
                                if (newValues.fhir.name && newValues.fhir.name.length > 0) {
                                    res += '\n function FHIR(x:I' + newValues.fhir.name + '):I' + newValues.fhir.name + '\n';
                                }
                                disposableFhirLib = monaco.languages.typescript.javascriptDefaults.addExtraLib(res, 'filename/fhir.d.ts');
                                break;
                        }
                    }
                })
            }
        }

        function configNgModelLink(monacoeditor, ngModel, scope) {
            if (!ngModel) { return; }
            // Monaco Editor expects a string, so make sure it gets one.
            // This does not change the model.
            ngModel.$formatters.push(function (value) {
                if (angular.isUndefined(value) || value === null)
                    return '';
                else if (angular.isObject(value) || angular.isArray(value))
                    throw new Error('ui-monacoeditor cannot use an object or an array as a model');
                return value
            });

            // Override the ngModelController $render method, which is what gets called when the model is updated.
            // This takes care of the synchronizing the monacoEditor element with the underlying model, in the case that it is changed by something else.
            ngModel.$render = function () {
                // Monaco Editor expects a string so make sure it gets one
                // Although the formatter has already done this, it can be possible that another formatter returns undefined (for example the required directive)
                var safeViewValue = ngModel.$viewValue || '';
                monacoeditor.setValue(safeViewValue);
            };

            // Keep the ngModel in sync with changes from MonacoEditor
            monacoeditor.onDidChangeModelContent(function (e) {
                var newValue = monacoeditor.getValue();
                if (newValue !== ngModel.$viewValue) {
                    scope.$evalAsync(function () {
                        ngModel.$setViewValue(newValue)
                    })
                }
            })
        }

        function configUiRefreshAttribute(monacoeditor, ngModel, uiRefreshAttr, scope) {
            if (!uiRefreshAttr) { return; }

            scope.$watch(uiRefreshAttr, function (newVal, oldVal) {
                // Skip the initial watch firing
                if (newVal !== oldVal) {
                    $timeout(function () {
                        ngModel.$render();
                    });
                }
            });
        }

        function configureOnEnterAttribute(monacoeditor, onEnterAttr, scope) {
            monacoeditor.onKeyDown(function(evt){
                if (evt.code === "Enter") {
                    var oneterfunction = scope.$eval(onEnterAttr);
                    if (oneterfunction) {
                        var model = monacoeditor.getModel();
                        oneterfunction(model.getValue());
                    }
                }
            });
        }

        function configAutoCompleteAttribute(monacoeditor, autocompleteAttr, scope) {
            scope.$watch(autocompleteAttr, function (newVal, oldVal) {
                provider.provideCompletionItems = function (model, position) {
                    const lineTextBefore = model.getLineContent(position.lineNumber).substring(0, position.column - 1).trim();
                    if (lineTextBefore.endsWith("customLocalizedStrings[") || lineTextBefore.endsWith("session.getCustomLocalizedValue(")) {
                        return newVal
                            .filter(function(opt) { return typeof opt === "object" &&  opt.type === 'custom_localization'})
                            .map(function (opt) {
                                return {
                                    label: opt.label,
                                    kind: monaco.languages.CompletionItemKind.Text,
                                    detail: opt.documentation,
                                    insertText: opt.value
                                };
                            })
                    }
                    else if (lineTextBefore.endsWith("systemLocalizedStrings[") || lineTextBefore.endsWith("session.getSystemLocalizedValue(")) {
                        return newVal
                            .filter(function(opt) { return typeof opt === "object" &&  opt.type === 'system_localization'})
                            .map(function (opt) {
                                return {
                                    label: opt.label,
                                    kind: monaco.languages.CompletionItemKind.Text,
                                    detail: opt.documentation,
                                    insertText: opt.value
                                };
                            })
                    }
                    else {
                        if (Array.isArray(newVal)) {
                            return newVal
                                .filter(function(opt) { return typeof opt === "string" || opt.type === "function" || opt.type === "object"})
                                .map(function (opt) {
                                if (typeof opt === "object") {
                                    return {
                                        label: opt.label,
                                        kind: monaco.languages.CompletionItemKind.Function,
                                        insertText: {value: opt.value + (opt.type === "function" ? '($0)' : '[$0]')}
                                    }
                                }
                                return {
                                    label: opt,
                                    kind: monaco.languages.CompletionItemKind.Variable,
                                    insertText: opt
                                };
                            });
                        }
                    }
                    return [];
                }
            });
        }
    });
