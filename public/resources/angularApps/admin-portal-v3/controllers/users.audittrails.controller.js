(function () {
    angular.module("adminPortalApp.controllers").controller("auditTrailsCtrl", AuditTrailsCtrl);

    AuditTrailsCtrl.$inject = ["$rootScope", "$http", "$moment", "auditTrail", "continuationToken"];

    function AuditTrailsCtrl($rootScope, $http, $moment, auditTrail, continuationToken) {
        const vm = this;
        vm.$onInit = $onInit;
        vm.getTimeRanges = getTimeRanges;
        vm.canLoadMore = canLoadMore;
        vm.loadMore = loadMore;
        vm.changeFilter = changeFilter;
        vm.refresh = refresh;

        const allTimeRange = "-1";
        const timeRanges = [
            { displayName: "Last 24 Hours", value: "1" },
            { displayName: "Last Week", value: "7" },
            { displayName: "Last 2 Weeks", value: "14" },
            { displayName: "Last Month", value: "30" },
            { displayName: "Last 2 Months", value: "60" },
            { displayName: "Last 3 Months", value: "90" },
            { displayName: "Last 6 Months", value: "180" },
            { displayName: "Last Year", value: "365" },
            { displayName: "All", value: allTimeRange }
        ];

        let dataTable;
        let currentToken;

        function $onInit() {
            dataTable = $("#auditTrailsTable");

            const data = auditTrail.map(auditTrailToRow);

            dataTable.dataTable({
                data,
                aoColumns: [
                    { title: "Time", render: { _: "calendarValue", sort: "timestamp" } },
                    { title: "Type" },
                    { title: "Action" },
                    { title: "Editor" },
                    { title: "Data", render: $.fn.dataTable.render.text() }
                ],
                order: [[0, "desc"]],
                pagingType: "full_numbers"
            });

            currentToken = continuationToken;

            vm.filter = "";
            vm.timeRange = timeRanges[0].value;
        }

        function getTimeRanges() {
            return timeRanges;
        }

        function canLoadMore() {
            return !!currentToken;
        }

        function loadMore() {
            fetchAuditTrail(currentToken);
        }

        function changeFilter() {
            dataTable.dataTable().api().search(vm.filter).draw(false);
        }

        function refresh() {
            dataTable.dataTable().api().clear().draw();
            
            fetchAuditTrail(null)
        }
        
        function fetchAuditTrail(token) {
            $rootScope.modal.show();

            const params = vm.timeRange !== allTimeRange && { timeFrameInDays: vm.timeRange };

            return $http
                .get(`./audit-trails/${JSON.stringify(token)}`, { params })
                .then(function ({ data }) {
                    currentToken = data.continuationToken;
                    
                    const rowsToAdd = data.auditTrail.map(auditTrailToRow);

                    dataTable.dataTable().api()
                        .rows.add(rowsToAdd)
                        .columns.adjust()
                        .draw(false);
                })
                .catch(function () {
                    $rootScope.toastr.error('Failed to get resources');
                })
                .finally($rootScope.modal.hide.bind($rootScope.modal));
        }

        function auditTrailToRow(log) {
            return [
                { calendarValue: $moment(log.createdAt).calendar(), timestamp: new Date(log.createdAt).getTime() },
                log.type || "",
                log.action || "",
                log.editor,
                log.data
            ];
        }
    };
})();
