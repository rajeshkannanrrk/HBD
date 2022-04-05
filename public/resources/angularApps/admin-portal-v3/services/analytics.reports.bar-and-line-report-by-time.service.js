angular.module('adminPortalApp.services')
    .service('BarAndLineReport', ['$http' ,function ($http) {
        var svc = this;
        function read(id, mode, top, onComplete) {
            $('#' + id).removeClass('no-activity');
            $http.get('./reports/reportData?name=' + id + "&mode=" + mode + "&top=" + top).then(
                function(response) {
                    if (!response.data) {
                        response.data = { labels: [], datasets: []};
                    }
                    if (mode === "24 hours") {
                        for (var i = 0; i < response.data.labels.length; i++) {
                            response.data.labels[i] = moment(moment.utc(response.data.labels[i]).toDate()).format("hh:00 a")
                        }
                    }
                    onComplete(response.data);
                },
                function(httpError) {
                    window.toastr.error('Problem with reading - ' + id);
                    onComplete({ labels: [], datasets: []});
                }
            );
        }

        function drawTitleText(id, titleTextValue, titleTextId) {
            if (titleTextValue === null || titleTextValue === undefined) {
                $('#' + id + titleTextId).hide();
            }
            else {
                $('#' + id + titleTextId).show();
                $('#' + id + titleTextId).html(titleTextValue);
            }
        }

        function getValueIfDefined(val) {
            return val === undefined ? "" : val;
        }

        function draw(id, data, colors, options) {


            drawTitleText(id, data.rightTitleText1, 'RightTitleText1');
            drawTitleText(id, data.rightTitleText2, 'RightTitleText2');

            var w = $('#' + id).width();
            var h = $('#' + id).height();
            $('#' + id).html('<canvas id="' + id + '-chart" width="' + w + '" height="' + h + '"></canvas>');
            if (data.datasets.length === 0) {
                return $('#' + id).addClass('no-activity');
            }
            $('#' + id).removeClass('no-activity');

            var chartDataCount = {
                labels: data.labels,
                datasets: [
                    {
                        type: 'line',
                        label: data.datasets[0].label,
                        data: data.datasets[0].data,
                        backgroundColor: colors[1],
                        borderColor: colors[1],
                        borderWidth: 2,
                        fill: false,
                        lineTension: 0,
                        yAxisID: 'y-axis-1'
                    },
                    {
                        type: 'bar',
                        label: data.datasets[1].label,
                        data: data.datasets[1].data,
                        backgroundColor: colors[0],
                        borderColor: colors[0],
                        borderWidth: 2,
                        yAxisID: 'y-axis-2'
                    }

                ]
            };
            var ctxCount = document.getElementById(id + '-chart').getContext('2d');

            var ticksRightAxis = {
                callback: function (value) {
                    return value + getValueIfDefined(data.rightAxis.valuePostfix);
                }
            };

            var ticksLeftAxis = {
                callback: function (value) {
                    return value + getValueIfDefined(data.leftAxis.valuePostfix);
                }
            };

            function setLimitsIfDefined(ticksAxis, dataAxis) {
                if (dataAxis.minValue !== undefined && dataAxis.maxValue !== undefined) {
                    ticksAxis.min = dataAxis.minValue;
                    ticksAxis.max = dataAxis.maxValue;
                }
            }

            setLimitsIfDefined(ticksRightAxis, data.rightAxis);
            setLimitsIfDefined(ticksLeftAxis, data.leftAxis);

            new Chart(ctxCount, {
                type: 'bar',
                data: chartDataCount,
                options: {
                    responsive: true,
                    title: false,
                    tooltips: {
                        mode: 'index',
                        intersect: true
                    },
                    scales: {
                        xAxes: [{ stacked: true }],
                        yAxes: [
                            {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                id: 'y-axis-1',
                                ticks: ticksRightAxis,
                                scaleLabel: {
                                    display: true,
                                    labelString: data.rightAxis.label
                                },
                                gridLines: {
                                    display: false
                                }
                            },
                            {
                                ticks: ticksLeftAxis,
                                scaleLabel: {
                                    display: true,
                                    labelString:  data.leftAxis.label
                                },
                                type: 'linear',
                                display: true,
                                position: 'left',
                                id: 'y-axis-2'
                            }
                        ]
                    },
                    tooltips: {
                        callbacks: {
                            label: function (t, d) {
                                var text = d.datasets[t.datasetIndex].label + ": " + t.yLabel;

                                text += getValueIfDefined(t.datasetIndex === 0 ? data.rightAxis.valuePostfix : data.leftAxis.valuePostfix);
                                return text;
                            }
                        }
                    },
                    legend: options.legend
                }
            });
        }

        return {
            "read": read,
            "draw": draw
        };
    }]);