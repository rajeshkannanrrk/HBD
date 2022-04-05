(function() {
    angular.module('adminPortalApp.controllers')
        .controller('conversationTrailsCtrl', function ($rootScope, $scope, $http) {
            var root = $rootScope;
            var vm = this;
            vm.creatingData = false;
            $scope.example = {
                value: new Date()
            };
            vm.params = {
                range: {
                    start: moment().subtract(6, 'days'),
                    end: moment()
                },
                userId: ""
            };

            function updateRangeTextualRepresentation(label) {
                vm.params.range.startDate = vm.params.range.start.format("MM/DD/YYYY");
                vm.params.range.endDate = vm.params.range.end.format("MM/DD/YYYY");
                vm.params.range.startHour = vm.params.range.start.format("HH:mm");
                vm.params.range.endHour = vm.params.range.end.format("HH:mm");

                if (["Today", "Last 24 hours", "Last 3 days", "Last 7 days", "Last 30 days", "This month", "This year"].indexOf(label) > -1) {
                    vm.params.range.endDate = "Now";
                    vm.params.range.endHour = null;
                }
                setTimeout(function () {
                    $scope.$apply();
                }, 5);
            }
            updateRangeTextualRepresentation("Last 7 days");

            vm.init = function () {
                var approveExportElement = $('#approveExport');
                approveExportElement.on('shown.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                approveExportElement.on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });

                vm.selectedPeriod = $('#dataRetentionDays').val() ? $('#dataRetentionDays').val() : 3650;

                var ranges = {
                    'Today': [moment().startOf('day'), moment().endOf('day')],
                    'Yesterday': [moment().subtract(1, 'days').startOf('day'), moment().subtract(1, 'days').endOf('day')],
                    'Last 24 hours': [moment().subtract(1, 'days'), moment().endOf('day')],
                    'Last 3 days': [moment().subtract(2, 'days').startOf('day'), moment().endOf('day')],
                    'Last 7 days': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day')],
                    'Last 30 days': [moment().subtract(29, 'days').startOf('day'), moment().endOf('day')],
                    'This month': [moment().startOf('month'), moment().endOf('day')],
                    'Last month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
                    'This year': [moment().startOf('year'), moment().endOf('day')]
                };
                $('#range').daterangepicker({
                    "showDropdowns": false,
                    "minDate": "01/01/2019",
                    "maxDate": moment().add(1, "days").format("MM/DD/YYYY"),
                    "timePicker": true,
                    "timePicker24Hour": true,
                    "linkedCalendars": false,
                    "autoUpdateInput": false,
                    "opens": "right",
                    "alwaysShowCalendars": true,
                    "applyClass": "hb-btn hb-btn-primary",
                    "cancelClass": "hb-btn hb-btn-secondary",
                    "ranges": ranges,
                }, function(start, end, label) {
                    if (label && label !== "Custom Range") {
                        start = this.ranges[label][0];
                        end = this.ranges[label][1];
                    }
                    else {
                        start
                            .hours($('.drp-calendar.left .calendar-time .hourselect').val())
                            .minutes(($('.drp-calendar.left .calendar-time .minuteselect').val()));
                        end
                            .hours($('.drp-calendar.right .calendar-time .hourselect').val())
                            .minutes(($('.drp-calendar.right .calendar-time .minuteselect').val()));
                    }
                    vm.params.range.start
                        .year(start.get('year'))
                        .month(start.get('month'))
                        .date(start.get('date'))
                        .hours(start.get('hours'))
                        .minutes(start.get('minutes'));
                    vm.params.range.end
                        .year(end.get('year'))
                        .month(end.get('month'))
                        .date(end.get('date'))
                        .hours(end.get('hours'))
                        .minutes(end.get('minutes'));
                    updateRangeTextualRepresentation(label);
                });

                vm.periods = [{text:"1 day", value:1},
                            {text:"2 days", value:2}, 
                            {text:"7 days", value:7},
                            {text:"30 days", value:30},
                            {text:"60 days", value:60},
                            {text:"90 days", value:90},
                            {text:"120 days",value:120},
                            {text:"180 days",value:180},
                            {text:"1 Year", value:365},
                            {text:"5 Years",value:1825},
                            {text:"10 Years", value:3650}];
                            
                vm.retentionPolicyEnabled = false
                // Read data from strorage
                vm.readDataRetentionPolicy();
            };

            vm.validation = {};
            vm.verifyRequest = function() {
                vm.validation = {};
                if (!vm.params.range.start || !vm.params.range.end) {
                    vm.validation.dateRange = "Time range must be specified";
                    return false;
                } else {
                    if (vm.params.range.start > vm.params.range.end) {
                        vm.validation.dateRange = "Invalid date range";
                        return false;
                    }
                }
                return true;
            };

            vm.showDisclaimer = function() {
                $("#exportDisclaimerPopup").modal();
            };

            vm.showRetensionDisclaimer = function() {
                $("#retensionDisclaimerPopup").modal();
            }

            vm.toggleRetentionPolicy = function() {
                if (!vm.retentionPolicyEnabled) {
                    vm.selectedPeriod = vm.prevSelectedPeriod > 0 ? vm.prevSelectedPeriod : 3650;                                             
                    vm.retentionPolicyEnabled = true;                    
                }
                else {
                    vm.retentionPolicyEnabled = false;
                    vm.selectedPeriod = 0;                    
                }
                vm.enableDisableItems();
            }

            vm.saveOrConfirmDataRetention = function() {
                if (vm.retentionPolicyEnabled) {
                    vm.showRetensionDisclaimer();
                }
                else {
                    vm.saveDataRetention();
                }
            }

            vm.enableApplyButton = false;

            vm.enableDisableItems = function() {
                vm.enableApplyButton = (vm.prevSelectedPeriod !== vm.selectedPeriod) ? true : false;
            }

            vm.readDataRetentionPolicy = function() {
                root.modal.show();
                $http.get('./conversation-logs/dataRetentionPolicy').then(function(response) {
                    root.modal.hide();
                    vm.prevSelectedPeriod = response.data.dataRetentionDays;                    
                    vm.selectedPeriod = vm.prevSelectedPeriod;
                    if (vm.prevSelectedPeriod > 0) {
                        vm.retentionPolicyEnabled = true;
                    }
                    else {
                        vm.retentionPolicyEnabled = false;                        
                    }                  
                    vm.enableDisableItems();
                }, function(err) {
                    root.modal.hide();
                    root.toastr.error("Sorry, an error occurred while loading data retention policy");
                });
            }

            vm.saveDataRetention = function() {
                root.modal.show("Saving Data Retention Policy");
                $http.post('./conversation-logs/dataRetentionPolicy', {
                    retentionPeriod: vm.retentionPolicyEnabled ? vm.selectedPeriod : 0
                }).then(function(response){
                    root.modal.hide();
                    if (response.status === 200) {
                        vm.enableApplyButton = false;
                        root.modal.hide();
                        root.toastr.success('Data Retention Policy Saved');                        
                        vm.prevSelectedPeriod = vm.selectedPeriod;
                    }
                }, function(err){
                    root.modal.hide();
                    root.toastr.error("Sorry, an error occurred while saving data retention policy");
                });
            }


            vm.exportConversationTrails = function () {
                if (vm.verifyRequest()) {
                    var a = document.createElement('a');
                    a.href = './conversation-logs/export?requestDate=' + moment().valueOf()
                        + '&startDate=' + vm.params.range.start.valueOf()
                        + '&endDate=' + (vm.params.range.endHour ? vm.params.range.end.valueOf() : moment().valueOf())
                        + '&userId=' + vm.params.userId;
                    a.target = "_blank";
                    setTimeout(function() {a.click(); }, 100);
                }
            };
        });
})();
