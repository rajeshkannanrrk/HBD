angular.module('adminPortalApp.services')
    .service('BarReportByTime', ['$http' ,function ($http) {
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

        function draw(id, data, colors, options) {
            var w = $('#' + id).width();
            var h = $('#' + id).height();
            $('#' + id).html('<canvas id="' + id + '-chart" width="' + w + '" height="' + h + '"></canvas>');

            if (data.datasets.length === 0) {
                return $('#' + id).addClass('no-activity');
            }
            $('#' + id).removeClass('no-activity');
            var totalDiv = document.createElement("div");
            totalDiv.classList.add("total");
            var total = data.datasets.map(function (dataset) {return dataset.data.reduce(function (a, b) { return a + b }, 0)}).reduce(function (a, b) { return a + b }, 0);
            if (total > 1000000000) {
                total = (Math.round(100 * total / 1000000) / 100) + "B";
            }
            else if (total > 1000000) {
                total = (Math.round(100 * total / 1000000) / 100) + "M";
            }
            else {
                total = total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            }
            totalDiv.innerHTML = "Total: " + total;
            $('#' + id).append(totalDiv);
            var cahrtData = {
                labels: data.labels,
                datasets: data.datasets
            };
            cahrtData.datasets.forEach(function(ds, i) {
                ds.backgroundColor = colors[i];
                ds.borderColor = colors[i];
                ds.onclick = function (e, i) {
                    // console.log('barHandler', e, i)
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
        }

        return {
            "read": read,
            "draw": draw
        };
    }]);
