angular.module('adminPortalApp.services')
    .service('BarReportByTimeAndTotal', ['$http' ,function ($http) {
        var svc = this;
        function read(id, mode, top, onComplete) {
            $('#' + id).removeClass('no-activity');
            $http.get('./reports/reportData?name=' + id + "&mode=" + mode + "&top=" + top).then(
                function(response) {
                    var totals = {};
                    if (!response.data) {
                        response.data = { labels: [], datasets: []};
                    }
                    if (response.data.datasets.length === 0) {
                        totals = { labels: [], datasets: []};
                    }
                    else {
                        var labels = [];
                        var fullLabels = [];
                        var datasets = [{label: "Total", data: []}];
                        for (var i = 0; i < response.data.datasets.length; i++) {
                            var ds = response.data.datasets[i];
                            ds.fullLabel = ds.label;
                            labels.push(ds.label);
                            fullLabels.push(ds.fullLabel);
                            var sum = 0;
                            ds.data.forEach(function(count) { sum += count; });
                            datasets[0].data.push(sum);
                        }

                        totals = { labels: labels, datasets: datasets, fullLabels: fullLabels};

                    }
                    if (mode === "24 hours") {
                        for (var i = 0; i < response.data.labels.length; i++) {
                            response.data.labels[i] = moment(moment.utc(response.data.labels[i]).toDate()).format("hh:00 a")
                        }
                    }
                    onComplete({ time: response.data, total: totals });
                },
                function(httpError) {
                    window.toastr.error('Problem with reading - ' + id);
                    onComplete({ time: { labels: [], datasets: []}, total: { labels: [], datasets: []} });
                }
            );
        }

        function draw(id, data, colors, options) {
            if (options.colors !== undefined) {
                colors = options.colors;
            }

            var timeChart = drawTime(id + "Time", data.time, colors, options);
            drawTotal(id + "Total", data.total, colors, timeChart, options.dataType);
        }

        function drawTotal(id, data, colors, timeChart, dataType) {

            $('#' + id).parent().find(".total-doughnut").html("");
            var total = 0;
            try {
                total = data.datasets.map(function (dataset) {return dataset.data.reduce(function (a, b) { return a + b }, 0)}).reduce(function (a, b) { return a + b }, 0);
            } catch (e) {
                // nothing
            }
            var w = $('#' + id).width();
            var h = $('#' + id).height();
            $('#' + id).html('<canvas id="' + id + '-chart" width="' + w + '" height="' + h + '"></canvas>');
            if (data.datasets.length === 0) {
                return;
            }

            {
                var totalText = total;
                if (totalText > 1000000000) {
                    totalText = (Math.round(100 * totalText / 1000000) / 100) + "B";
                }
                else if (totalText > 1000000) {
                    totalText = (Math.round(100 * totalText / 1000000) / 100) + "M";
                }
                else if (totalText === 0) {
                    totalText = "";
                }
                else {
                    totalText = totalText.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                }
                $('#' + id).parent().find(".total-doughnut").html(totalText);
            }


            var canvas = document.getElementById(id + '-chart').getContext('2d');
            canvas.clear();
            new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: data.fullLabels,
                    datasets: [{
                        label: "Count",
                        backgroundColor: colors,
                        stack: 'm',
                        data: data.datasets[0].data
                    }]
                },
                options: {
                    legend: false,
                    title: false,
                    scales: {yAxes: [{display: false}]},
                    plugins: {},
                tooltips: {
                        backgroundColor: "#0071ca",
                        fontColor: "white",
                        callbacks: {
                            label: function(tooltipItem, data) {
                                return "";
                            },
                            footer: function(tooltipItems, data) {
                                try {
                                    var index = tooltipItems[0].index;
                                    var dataset = data.datasets[0];
                                    var lines = [];
                                    try {
                                        var step = RegExp(/\[(?<scenario>.*)\] (?<id>.*)/ig).exec(data.labels[index]).groups;
                                        lines.push(step.id);
                                        lines.push(' ');
                                        lines.push('Scenario "' + step.scenario + '"');
                                    } catch (e) {
                                        // Split the string according to max characters per line, due to chart.js bug of
                                        // tooltip cut off string that are longer than the chart bounds
                                        const LINE_MAX_LENGTH  = 30;
                                        var words = data.labels[index]?.split(' ');
                                        var curLine = '';
                                        words?.forEach(function (word) {
                                            if (curLine.length != 0 && curLine.length + word.length > LINE_MAX_LENGTH) {
                                                lines.push(curLine);
                                                curLine = '';
                                            }
                                            curLine += word + ' ';
                                        })
                                        lines.push(curLine);
                                    }
                                    var currentValue = dataset.data[index];
                                    var percentage = Math.round(10000 * currentValue / total)/100;
                                    lines.push(currentValue + " occurrences");
                                    lines.push(percentage + "% of all " + dataType);
                                    return lines;
                                } catch (e) {
                                    return [];
                                }


                            }
                        }
                    },
                    onClick: function(evt) {
                        var currentChart = this.chart;
                        var dsObject = currentChart.getElementAtEvent(evt)[0];
                        if (dsObject) {
                            var dsIndex = currentChart.getElementAtEvent(evt)[0]._index;
                            timeChart.data.datasets.forEach(function (e, datasetIndex) {
                                var datasetMetadata = timeChart.getDatasetMeta(datasetIndex);
                                datasetMetadata.hidden = true;
                            });
                            timeChart.getDatasetMeta(dsIndex).hidden = false;
                        }
                        else {
                            timeChart.data.datasets.forEach(function (e, datasetIndex) {
                                var datasetMetadata = timeChart.getDatasetMeta(datasetIndex);
                                datasetMetadata.hidden = false;
                            });
                        }
                        timeChart.update();

                    }
                }
            });
        }

        function drawTime(id, data, colors, options) {
            if (options.colors !== undefined) {
                colors = options.colors;
            }

            var w = $('#' + id).width();
            var h = $('#' + id).height();
            $('#' + id).html('<canvas id="' + id + '-chart" width="' + w + '" height="' + h + '"></canvas>');
            if (data.datasets.length === 0) {
                    return $('#' + id).addClass('no-activity');
            }
            $('#' + id).removeClass('no-activity');
            var cahrtData = {
                labels: data.labels,
                datasets: data.datasets
            };
            cahrtData.datasets.forEach(function(ds, i) {
                ds.backgroundColor = colors[i];
                ds.borderColor = colors[i];
                ds.onclick = function (e, i) {
                    console.log('barHandler', e, i)
                }
            });
            var canvas = document.getElementById(id + '-chart');
            var chartElm = canvas.getContext("2d");
            var chart = new Chart(chartElm, {
                type: 'bar',
                data: cahrtData,
                tooltips: false,
                options: {
                    responsive :true,
                    title: false,
                    plugins: {},
                    scales: {
                        xAxes: [{ stacked: true }],
                        yAxes: [{ stacked: true }]
                    },
                    legend: options.legend,
                    onClick: options.onClick
                },
            });
            return chart;
        }

        return {
            "read": read,
            "draw": draw
        };
    }]);
