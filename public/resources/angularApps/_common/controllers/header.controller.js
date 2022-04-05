function registerHeaderController(env) {
    angular.module(env + '.controllers')
        .controller('headerCtrl', function ($window, $rootScope, $scope, $http ) {
            var vm = this;
            var root = $rootScope;
            root.readonly = true;
            vm.webchat_locale = { selected: "en-US" };
            vm.feedbackScore = "";
            vm.includeEmail = true;
            vm.planData = null;
            vm.validationError = null;
            vm.validationSucceeded = false;
            vm.qs = null;

            vm.init = function() {
                vm.readPlanData();
                $http.get('../sysadminReadonly').then(
                    function(response) {
                        root.readonly = response.data;
                        if (!root.readonly && root.toggleReadOnlyCallback) {
                            root.toggleReadOnlyCallback();
                        }

                    },
                    function(httpError) {
                        root.readonly = true;
                });
                
                // get surveyId                
                $http.post('../portal-feedbacks/surveyId').then((response) => {
                    if (response && response.status == 200 && response.data) {
                        var surveyId = response.data.surveyId;
                        // initialize survey values
                        if (surveyId == "tenant_satisfaction") {
                            vm.tenantSatisfaction = {
                                id: surveyId,
                                modalDivSelector: '#tenant-satisfaction-survey-modal',
                                nps: null,
                                ces: null,
                                cva: null,
                                text: null,
                                dontShow: false,
                                canEmail: true,
                            };
                            var modalOptions = {
                                backdrop: 'static',
                                keyboard: false,
                            }
                            $(vm.tenantSatisfaction.modalDivSelector).modal(modalOptions);
                        }
                    }
                }, (err) => {
                    console.log(`error: ${err}`);
                });
            };

            vm.canSubmitSurvey = () => {
                return vm.tenantSatisfaction && (vm.tenantSatisfaction.nps || vm.tenantSatisfaction.ces || vm.tenantSatisfaction.cva);
            };

            vm.submitSurvey = (survey) => {
                $http.post('../portal-feedbacks/survey', {
                    survey
                }).then((response) => {
                    if (response.status === 200) {
                        window.toastr.success("Survey Submitted");
                    } else {
                        window.toastr.error(response.status + ' ' + response.statusText + ": " + response.data);
                    }
                }, (err) => {
                    window.toastr.error(`Sorry, an error occurred. Please try again ${err.message ? err.message : ''}`);
                });
                $(survey.modalDivSelector).modal('hide');
            };
            
            vm.closeSurvey = (survey) => {
                $http.post('../portal-feedbacks/survey/close', {
                    survey
                }).then((response) => {
                    if (response.status === 200) {
                        console.log(`stopping to show survey ${survey.id}`);
                    }
                }, (err) => {
                    window.toastr.error(`Sorry, an error occurred. Please try again ${err.message ? err.message : ''}`);
                });
                $(survey.modalDivSelector).modal('hide');
            };

            vm.openDrawer = root.openDrawer;
            vm.closeDrawer = root.closeDrawer;

            vm.toggleReadOnly = function() {
                $http.get('../sysadminReadonly/toggle').then(
                    function(response) {
                        if (response.status === 200) {
                            root.readonly = response.data;
                            if (root.readonly) {
                                window.toastr.success("Read only mode");
                            } else {
                                window.toastr.warning("Read/Write mode");
                            }
                            if (root.toggleReadOnlyCallback) {
                                root.toggleReadOnlyCallback();
                            }
                        } else {
                            window.toastr.error(response.status + ' ' + response.statusText + ": " + response.data);
                        }
                    },
                    function(httpError) {
                        window.toastr.error("Sorry, an error occurred. Please try again");
                    });
            };

            vm.openFeedbackDrawer = function() {
                vm.feedbackText = "";
                vm.feedbackScore = "";
                vm.includeEmail = true;
                vm.feedbackValidation.feedbackErrReason = "";
                vm.feedbackValidation.emptyFeedbackErr = "";
                vm.openDrawer('feedbackDrawer');
            };

            vm.settingsMenuClick = function () {
                vm.readPlanData();
            };

            vm.readPlanData = function() {
                $http.get('../plan').then(
                    function(response) {
                        if (response.data.planId) {
                            var plan = response.data.planId[0].toUpperCase() + response.data.planId.slice(1).toLowerCase();
                            var c = Number(response.data.msgCount);
                            var mcu = Number(response.data.medicalEncounters);
                            var m = Number(response.data.maxMessages);
                            var maxMCUs = Number(response.data.maxMCUs);
                            var perc = Math.min(100, Math.floor((100 * c) / m));
                            var percMcu = Math.min(100, Math.floor((100 * mcu) / maxMCUs));

                            var cls = perc < 60 ? "progress-bar progress-bar-good" : perc < 80 ? "progress-bar progress-bar-warning" : "progress-bar progress-bar-danger";
                            var clsMcu = percMcu < 60 ? "progress-bar progress-bar-good" : percMcu < 80 ? "progress-bar progress-bar-warning" : "progress-bar progress-bar-danger";
                            
                            m_s = numberToString(m);
                            maxMCUs_s = numberToString(maxMCUs);
                            var mm = (c - m) > 0 ? (c - m) : 0;
                            var mm_s = numberToString(mm);
                            var mu = mcu > maxMCUs > 0 ? mcu - maxMCUs : 0;
                            var mu_s = numberToString(mu);

                            vm.planData = {
                                plan: planIdToPlanName(plan),
                                planId: response.data.planId,
                                planType: response.data.planType,
                                isConsumptionPlan:response.data.isConsumptionPlan,
                                month:  (new Date()).toLocaleString('default', { month: 'short' }),
                                usage:  numberToString(Math.min(c,m)) + " / " + m_s + " used",
                                mcuUsage: numberToString(Math.min(mcu, maxMCUs)) + " / " + maxMCUs_s + " used",
                                meteredMsgs: mm_s + " ($" + (mm * response.data.messagePrice).toFixed(2) + ")",
                                meteredMCUs: mu_s + " ($" + (mu * response.data.mcuPrice).toFixed(2) + ")",
                                maxMCUs: maxMCUs,
                                perc: perc,
                                percMcu: percMcu,
                                cls: cls,
                                clsMcu: clsMcu
                            }

                            function numberToString(num) {
                                return num < 1000 ? num : (num >= 1000 && num < 1000000) ? Math.floor(num / 1000) + 'K' : Math.floor(num / 1000000) + 'M'
                            }

                            function planIdToPlanName(plan) {
                                switch(plan) {
                                    case 'C0': 
                                        return 'Covid (C0)';
                                    case 'S1':
                                        return 'Standard (S1)';
                                    case 'F0':
                                        return 'Free (F0)'
                                    default:
                                        return plan;
                                }
                            }
                        }
                    },
                    function(httpError) {
                        vm.planData = null;
                    });
            };

            vm.openWebchatDrawer = function() {
                vm.openDrawer('webchatDrawer');
                setTimeout(function (){
                    $('#webChatIframe').attr('tabindex', '0');
                }, 50);
                vm.loadWebChatDemo();
            };

            vm.sendingFeedback = false;
            vm.feedbackValidation = {};
            vm.submitFeedback = function() {
                if (!vm.feedbackText){
                    vm.feedbackValidation.emptyFeedbackErr = 'Required information is missing';
                    vm.feedbackValidation.feedbackErrReason = "MissingText";
                    $('#feedback-text').trigger("focus");
                    return;          
                } 
                if (!vm.feedbackScore){
                    vm.feedbackValidation.emptyFeedbackErr = 'Required information is missing';
                    vm.feedbackValidation.feedbackErrReason = "MissingScore";
                    return;               
                } 
                else {
                    vm.feedbackValidation.emptyFeedbackErr = null;
                }

                vm.sendingFeedback = true;
                $http.post('../portal-feedbacks/feedback', {
                    feedbackText: vm.feedbackText,
                    feedbackScore: vm.feedbackScore,
                    includeEmail: vm.includeEmail
                }).then(function(response) {
                    vm.closeDrawer('feedbackDrawer');
                    vm.sendingFeedback = false;
                    if (response.status === 200) {
                        window.toastr.success("Feedback Submitted");
                    }
                    else {
                        window.toastr.error(response.status + ' ' + response.statusText + ": " + response.data);
                    }
                }, function(err) {
                    vm.sendingFeedback = false;
                    window.toastr.error("Sorry, an error occurred. Please try again");
                });
            };

            vm.changeWebChatLocale = function() {
                $http.get('../webchatToken').then(
                    function(tokenResponse) {
                        $('#webChatIframe').attr('src', $('#webChatIframe').attr('webchat') + "?t=" + tokenResponse.data + "&locale=" + vm.webchat_locale.selected + "&domain=" + $('#webChatIframe').attr('domain'));
                        $('#webChatIframe')[0].onload = function (a) {
                            $('#webChatIframe').css('opacity', '1');
                        }
                    },
                    function(err) {
                        window.toastr.error("Sorry, an error occurred. Please try again");
                    })
            };

            vm.loadWebChatDemo = function(){
                if (!$('#webChatIframe').attr('src')) {
                    if ($('#webChatIframe').attr('src')) {
                        $('#webChatIframe').css('opacity', '0');
                    }
                    $http.get('../webchatToken').then(function(tokenResponse) {
                        $http.get('../language-models/localization/locales').then(function(localesResponse) {
                            vm.webchat_locales = localesResponse.data;
                            vm.webchat_locale.selected = "en-us";
                            $('#webChatIframe').attr('src', $('#webChatIframe').attr('webchat') + "?t=" + tokenResponse.data + "&locale=" + vm.webchat_locale.selected + "&domain=" + $('#webChatIframe').attr('domain'));
                            $('#webChatIframe')[0].onload = function (a) {
                                $('#webChatIframe').css('opacity', '1');
                            }
                        }, function(err) {
                            window.toastr.error("Sorry, an error occurred. Please try again");
                        });

                    }, function(err) {
                        window.toastr.error("Sorry, an error occurred. Please try again");
                    });


                }
            };

            vm.backup = function(qs) {
                while ($('.drawer.drawer-opened').length > 0) {
                    vm.closeDrawer($('.drawer.drawer-opened')[0].id);
                }
                $('#settings-button').trigger("blur");
                root.modal.show('Creating backup');
                function getFileNameFromHeader(header){
                    if (!header) {
                        return null;
                    }
                    var result= header.split(";")[1].trim().split("=")[1];
                    return result.replace(/"/g, '');
                }
                $http({
                    method: 'GET',
                    url: '../backup?' + qs,
                    headers: {
                        accept: 'text/plain'
                    },
                    responseType: 'arraybuffer',
                    cache: false,transformResponse: function(data, headers) {
                        var d = null;
                        if (data) {
                            d = new Blob([data], {
                                type: 'text/plain'
                            });
                        }
                        var fileName = getFileNameFromHeader(headers('content-disposition'));
                        var result = {
                            blob: d,
                            fileName: fileName
                        };
                        return {
                            response: result
                        };
                    }
                }).then(function successCallback(response) {
                    root.modal.hide();
                    var blob = response.data.response.blob;
                    var fileName = response.data.response.fileName.trim() || 'backup.hbs';
                    var link=document.createElement('a');
                    link.href=window.URL.createObjectURL(blob);
                    link.download = fileName;
                    link.click();
                }, function errorCallback(response) {
                    root.modal.hide();
                    if (response.status === 403) { return window.toastr.error(response.status + ' ' + response.statusText + ": " + response.data); }
                    window.toastr.error("Sorry, an error occurred while exporting selected scenarios. Please try again");
                });
            };

            vm.showRestore = function() {
                $('#settings-button').trigger("blur");
                vm.ack = "";
                vm.validationError = null;
                vm.validationSucceeded = false;
                root.openDrawer('portalRestoreDrawer');
            };

            vm.restore = function() {
                if (vm.ack !== "Restore") {
                    return;
                }
                var form = new FormData();
                var filesArr = $('#fileSelector')[0].files;
                if (filesArr.length !== 1) {
                    vm.validationError = 'Please select a single zip file to restore';
                    return;
                }
                form.append('backup', filesArr[0]);
                root.modal.show("Restoring backup");
                root.closeDrawer('portalRestoreDrawer');
                $http({
                    method: 'POST',
                    url: '../restore',
                    data: form,
                    headers: { 'Content-Type': undefined},
                    transformRequest: angular.identity
                }).then(function successCallback(response) {
                    root.modal.hide();
                    window.toastr.success("Restore completed successfully, reloading page");
                    vm.validationError = null;
                    vm.validationSucceeded = true;
                    location.href = location.href;
                }, function errorCallback(response) {
                    root.openDrawer('portalRestoreDrawer');
                    window.toastr.error(response.data);
                    vm.validationError = response.data;
                    vm.validationSucceeded = false;
                    root.modal.hide();
                });
            };

            vm.openURL = function(url) {
                $window.open(url, '_blank');
            };

            vm.openSupportLink = function() {document.activeElement.blur();
                vm.openURL("https://aka.ms/HealthBot/support");
            };

            vm.openDocumentationLink = function() {
                document.activeElement.blur();
                vm.openURL("https://docs.microsoft.com/en-us/HealthBot/");
            };

            vm.openPortalInfoDrawer = function() {
                document.activeElement.blur();
                vm.openDrawer('portalSettingsDrawer');
            };

            vm.login = function() {
                location.reload();
            };

            vm.logout = function () {
                document.activeElement.blur();
                root.modal.show('Signing out');
                $http.post('/logout').then(function (response) {
                    root.modal.hide();
                    if (response.status === 200) {
                        $('#loggedOut').modal('show');
                    }
                    else {
                        window.toastr.error('sorry');
                    }
                }, function (err) {
                    root.modal.hide();
                    window.toastr.error('sorry');
                } )
            };

            vm.openAdminPortal = function (url) {
                document.activeElement.blur();
                vm.openURL(url);
            }

            vm.openAzureResource = function (url) {
                document.activeElement.blur();
                vm.openURL(url);
            }

            vm.menuKeyboardClickHandler = function (e) {
                var element = e.currentTarget;
                switch (e.keyCode) {
                    case 13: // enter
                    case 32: //space
                        setTimeout(function() {
                            element.click();
                        }, 1);
                        break;
                }
            }
        });
}
