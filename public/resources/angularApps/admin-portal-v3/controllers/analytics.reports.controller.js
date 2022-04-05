(function() {
    angular.module('adminPortalApp.controllers')
        .controller('reportsCtrl', function ($rootScope, $scope, $http, $timeout, $window, $moment, BarReportByTime, BarReportByTimeAndTotal, BarAndLineReport) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;

            vm.colors = [ "#248F8D", "#2C4059", "#542338", "#C2263E", "#EF7A3E", "#EED173", "#F7F3D4", "#AAECD8"];

            vm.dayModes = {
                hours: ["24 hours"],
                days: ["7 days", "30 days", "90 days"],
                months: [
                    moment().format('MMM YYYY'),
                    moment().subtract(1, 'month').format('MMM YYYY'),
                    moment().subtract(2, 'month').format('MMM YYYY')
                ],
                other: ["Monthly"]
            };
            vm.modeToLabel = {
                "24 hours": "last 24 hours",
                "7 days": "last 7 days",
                "30 days": "last 30 days",
                "90 days": "last 90 days"
            };

            vm.customScenarioCompletionData = [];
            vm.customScenarioCompletionSelectedName = null;
            vm.customScenarioCompletionSelectedData = null;

            var modes = [];
            Object.keys(vm.dayModes).forEach(function(groupName) {
                vm.dayModes[groupName].forEach(function(mode) { modes.push(mode)});
            });

            vm.reports = {
                uniqueUsers: { name: "uniqueUsers", reportService: BarReportByTime, options: {legend: false}, data: {} },
                messages: { name: "messages", reportService: BarReportByTime, options: {onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler }}, data: {} },
                builtinScenariosSessions: { name: "builtinScenariosSessions", reportService: BarReportByTime, options: {onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler }}, data: {} },
                customScenariosSessions: { name: "customScenariosSessions", reportService: BarReportByTime, options: {onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler }}, data: {} },
                customScenariosOutcomes: { name: "customScenariosOutcomes", reportService: BarReportByTimeAndTotal, options: {onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler, labels: { boxWidth: 20, generateLabels: healthBotLegendLabelGenerator } }, dataType: "outcomes"}, data: {} },
                infermedicaTriageByComplaint: { name: "infermedicaTriageByComplaint", reportService: BarReportByTimeAndTotal, options: {onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler, labels: { boxWidth: 20, generateLabels: healthBotLegendLabelGenerator } }, dataType: "complaints"}, data: {} },
                capitaTriageByComplaint: { name: "capitaTriageByComplaint", reportService: BarReportByTimeAndTotal, options: {onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler, labels: { boxWidth: 20, generateLabels: healthBotLegendLabelGenerator } }, dataType: "complaints"}, data: {} },
                infermedicaTriageByOutcome: { name: "infermedicaTriageByOutcome", reportService: BarReportByTimeAndTotal, options: {onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler, labels: { boxWidth: 20, generateLabels: healthBotLegendLabelGenerator } }, dataType: "outcomes"}, data: {} },
                capitaTriageByOutcome: { name: "capitaTriageByOutcome", reportService: BarReportByTimeAndTotal, options: {onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler, labels: { boxWidth: 20, generateLabels: healthBotLegendLabelGenerator } }, dataType: "outcomes"}, data: {} },
                unrecognizedUtterances: { name: "unrecognizedUtterances", reportService: BarAndLineReport, options: {legend: false}, data: {} },
                feedbacksScore: { name: "feedbacksScore", reportService: BarAndLineReport, options: {legend: {display: true, position: 'top', align: 'center'}}, data: {} },
                feedbacksDistribution: { name: "feedbacksDistribution", reportService: BarReportByTimeAndTotal, options: {colors: ['#309e45', '#94d72d', '#fcc418', '#fe9229', '#ee1b24'], onClick: chartClickHandler, legend: { position: "right", onClick: healthBotLegendHandler, labels: { boxWidth: 20, generateLabels: healthBotLegendLabelGenerator } }, dataType: "submissions"}, data: {} }
            };

            vm.init = function() {
                vm.loadMode("24 hours");
                var reportItemsElements = $('.report-item');
                var reportsNavigator = $('.reports-navigator');
                for (var i = 0; i < reportItemsElements.length; i++) {
                    console.log(reportItemsElements[i].id);
                    var div = document.createElement("div")
                    var a = document.createElement('a');
                    a.classList.add("hb-btn");
                    a.classList.add("hb-btn-linkl");
                    var navigatorTitle = $(reportItemsElements[i]).find('.navigatorTitle').html();
                    var title = $(reportItemsElements[i]).find('.title').html();

                    a.innerHTML = navigatorTitle === undefined ? title : navigatorTitle;

                    a.href = "#" + reportItemsElements[i].id;
                    a.addEventListener('click', function (event){
                        setTimeout(function () {
                            $(event.target).trigger("focus");
                        });
                    });
                    div.append(a);
                    reportsNavigator.append(div);
                }
                root.refreshTabIndices();
            };
            var lastLoadTS = -1;

            vm.reloadMode = function() {
                vm.loadMode(vm.mode, true)
            };

            angular.element($window).on('resize', function(){
                Object.keys(vm.reports).forEach(function (reportName) {
                    var report = vm.reports[reportName];
                    report.reportService.draw(report.name, report.data, vm.colors, report.options);
                    resizeAction = null;
                });
            });

            vm.loadMode = function(mode, force) {
                if (!force && vm.mode === mode) {
                    return;
                }
                $('.report-item').addClass('loading');
                vm.mode = mode;
                var loadTS = new Date().getTime();
                lastLoadTS = loadTS;
                Object.keys(vm.reports).forEach(function (reportName) {
                    var report = vm.reports[reportName];
                    report.reportService.read(report.name, mode, vm.colors.length, function(data) {
                        if (loadTS === lastLoadTS) {
                            report.data = data;
                            $('.report-item.report-' + report.name).removeClass('loading');
                            report.reportService.draw(report.name, report.data, vm.colors, report.options);
                        }
                    });
                });

                vm.customScenarioCompletionData = [];
                vm.customScenarioCompletionSelectedName = null;
                vm.customScenarioCompletionSelectedScenario = null;
                $('.report-item.report-customScenarioCompletion').addClass('loading');
                $('.report-item.report-customScenarioCompletion .report-chart').removeClass('no-activity');
                $http.get("./reports/reportData?name=customScenarioCompletion&mode=" + mode + "&top=" + top).then(
                    function(response) {
                        $('.report-item.report-customScenarioCompletion').removeClass('loading');
                        vm.customScenarioCompletionData = response.data.map(function (item) {
                            item.endedLevel = Math.floor(item.endedRate / 20);
                            return item;
                        });
                        if (vm.customScenarioCompletionData.length === 0) {
                            $('.report-item.report-customScenarioCompletion .report-chart').addClass('no-activity');
                        } else {
                            vm.customScenarioCompletionSelectedName = vm.customScenarioCompletionData[0].name;
                            vm.customScenarioCompletionSelectedScenario = vm.customScenarioCompletionData[0];
                        }
                    },
                    function(httpError) {
                        $('.report-item.report-customScenarioCompletion').removeClass('loading');
                        $('.report-item.report-customScenarioCompletion').addClass('no-activity');
                        window.toastr.error('Problem with reading - scenarioAbandonment');
                        onComplete({ labels: [], datasets: []});
                    }
                );
            };

            vm.CustomScenarioCompletionDataLastSortedBy = null;
            vm.CustomScenarioCompletionDataSortDirection = -1;
            vm.sortCustomScenarioCompletionData = function (by) {
                vm.customScenarioCompletionData.sort(function(a, b) {
                    var res = 0;
                    switch (by) {
                        case "id":
                            res = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
                            break;
                        case "completion":
                            res = a.endedRate < b.endedRate ? -1 : a.endedRate > b.endedRate ? 1 : 0;
                            break;
                        default:
                            res = 0;
                    }
                    res *= vm.CustomScenarioCompletionDataSortDirection;
                    return res;
                });
                if (vm.lastSortedBy === by) {
                    vm.CustomScenarioCompletionDataSortDirection *= -1;
                } else {
                    vm.CustomScenarioCompletionDataSortDirection = 1;
                }
                vm.lastSortedBy = by;

                vm.customScenarioCompletionSelectedScenario = vm.customScenarioCompletionData.find(function(scenario) {
                    return scenario.name === vm.customScenarioCompletionSelectedName;
                });
            };

            function chartClickHandler (e) {
                var currentChart = this.chart;
                setTimeout(function() {
                    var currentItem = currentChart.getElementAtEvent(e)[0];
                    if (currentItem) {
                        var dsIndex = currentItem._datasetIndex;
                        currentChart.data.datasets.forEach(function (e, datasetIndex) {
                            var datasetMetadata = currentChart.getDatasetMeta(datasetIndex);
                            datasetMetadata.hidden = datasetIndex !== dsIndex;
                        });
                    }
                    else {
                        currentChart.data.datasets.forEach(function(e, datasetIndex) {
                            var datasetMetadata = currentChart.getDatasetMeta(datasetIndex);
                            datasetMetadata.hidden = false;
                        });
                    }
                    currentChart.update();
                });
            }
            function healthBotLegendHandler(e, legendItem) {
                var currentChart = this.chart;
                var barsVisibilityState = currentChart.data.datasets.map(function(e, datasetIndex) {
                    var datasetMetadata = currentChart.getDatasetMeta(datasetIndex);
                    return datasetMetadata.hidden || false;
                });
                setTimeout(function() {
                    var legendIndex = legendItem.datasetIndex;
                    barsVisibilityState.forEach(function( stateBeforeClickLogic, datasetIndex) {
                        var datasetMetadata = currentChart.getDatasetMeta(datasetIndex);
                        datasetMetadata.hidden = stateBeforeClickLogic;
                        datasetMetadata._hidden = stateBeforeClickLogic;
                    });
                    var isLegendCurrentlyHidden = currentChart.getDatasetMeta(legendIndex).hidden || false;
                    if (isLegendCurrentlyHidden) {
                        currentChart.getDatasetMeta(legendIndex).hidden = false;
                        currentChart.getDatasetMeta(legendIndex)._hidden = false;
                    }
                    else {
                        var areOtherLegendsHidden = false;
                        var allOtherLegendsHidden = true;
                        currentChart.data.datasets.forEach(function(e, datasetIndex) {
                            if (datasetIndex !== legendIndex) {
                                return;
                            }
                            var datasetMetadata = currentChart.getDatasetMeta(datasetIndex);
                            areOtherLegendsHidden = areOtherLegendsHidden || datasetMetadata.hidden;
                            allOtherLegendsHidden = allOtherLegendsHidden && datasetMetadata.hidden;
                        });

                        currentChart.data.datasets.forEach(function(e, datasetIndex) {
                            var datasetMetadata = currentChart.getDatasetMeta(datasetIndex);
                            if (datasetIndex !== legendIndex) {
                                datasetMetadata.hidden = (areOtherLegendsHidden && !allOtherLegendsHidden) || !datasetMetadata.hidden;
                                datasetMetadata._hidden = (areOtherLegendsHidden && !allOtherLegendsHidden) || !datasetMetadata.hidden;
                            }
                            else {
                                datasetMetadata.hidden = null;
                                datasetMetadata._hidden = null;
                            }
                        });
                    }
                    currentChart.update();
                });
            }

            function healthBotLegendLabelGenerator(chart) {
                var data = chart.data;
                return data.datasets.map(function(ds, i) {
                    var meta = chart.getDatasetMeta(i);
                    var arc = meta.data[i];
                    var custom = arc && arc.custom || {};
                    var getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                    var arcOpts = chart.options.elements.arc;
                    var fill = custom.backgroundColor ? custom.backgroundColor : getValueAtIndexOrDefault(ds.backgroundColor, i, arcOpts.backgroundColor);
                    var stroke = custom.borderColor ? custom.borderColor : getValueAtIndexOrDefault(ds.borderColor, i, arcOpts.borderColor);
                    var bw = custom.borderWidth ? custom.borderWidth : getValueAtIndexOrDefault(ds.borderWidth, i, arcOpts.borderWidth);
                    return {
                        text: ds.label.length > 25 ? ds.label.substr(0, 22) + "..." : ds.label,
                        fillStyle: fill,
                        strokeStyle: stroke,
                        lineWidth: bw,
                        hidden: meta.hidden,
                        index: i,
                        datasetIndex: i
                    };
                });
            }
        });
})();
