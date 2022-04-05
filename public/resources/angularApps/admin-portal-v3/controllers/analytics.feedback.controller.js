(function() {
    angular.module('adminPortalApp.controllers')
        .controller('feedbacksCtrl', function ($rootScope, $scope, $http, $timeout, $window, $moment) {
            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;

            /**************************************************************************************************
             * loading data on controller init event
             ***************************************************************************************************/
            vm.ready = false;
            vm.filter = {
                user: '',
                dateFrom: '',
                dateTo: ''
            };

            vm.filterUser;


            vm.allFeedbacks = [];
            vm.feedbacks = [];
            vm.selected = '';
            vm._currentPage = 0;
            vm.pageSize = 100;

            vm.numberOfPages = function(){
                return Math.ceil(vm.feedbacks.length / vm.pageSize);
            }

            vm.currentPage = function (){
                return Math.min(vm._currentPage, vm.numberOfPages() - 1);
            }
            
            vm.nextPage = function() {
                vm._currentPage += 1;
            }

            vm.prevPage = function() {
                vm._currentPage -= 1;
            }

            vm.lastPage = function() {
                return vm.feedbacks.length/vm.pageSize-1
            }

            vm.init = function() {
                vm.ready = false;
                vm.allFeedbacks = [];
                root.modal.show();
                $http.post('./feedback/all').then(
                    function(response) {
                        var users = {};
                        if (typeof(response.data) === 'string') {
                            vm.ready = true;
                            root.modal.hide();
                            return;
                        }
                        response.data.forEach(function(id, i) {
                            var timeStamp = id.split('/')[2];
                            timeStamp = timeStamp.substring(timeStamp.indexOf('-') + 1);
                            var time = new Date(timeStamp);
                            var newItem = {
                                i: i,
                                userName:id.split('/')[1],
                                timestampString: $moment(timeStamp).format('llll'),
                                timestamp: time.getTime(),
                                text: undefined,
                                id: id,
                                err: false,
                                visible: true,
                                fetched: false,
                                opened: false,
                                feedbackScoreText:undefined,
                                feedbackScore:undefined
                            };
                            users[newItem.userName] = true;
                            vm.allFeedbacks.push(newItem);
                        });
                        vm.feedbacks = vm.allFeedbacks.slice();
                        $timeout(function() {
                            $( "#filterUser" ).autocomplete({
                                source: Object.keys(users),
                                select: function(event, ui) {
                                    setTimeout(vm.applyFilter, 10);
                                }
                            });
                        }, 10);
                        root.modal.hide();
                        vm.ready = true;
                        updateAccordion();
                        root.refreshTabIndices();

                    },
                    function(response) {
                        root.modal.hide();
                        vm.noFeedbacks = true;
                        root.toastr.error("Sorry, an error occurred while reading feedbacks. Please try again");
                        vm.ready = true;
                        root.refreshTabIndices();
                    }
                );
            };

            vm.fetch = function(feedback, cb, param) {
                if (feedback && !feedback.fetched) {
                    $http.post('./feedback/all', {
                        ids: new Array(feedback.id)
                    }).then(
                        function(response) {
                            const responseObject = response.data[0];
                            feedback.displayedText = responseObject;
                            if (responseObject.feedback !== undefined) {
                                // "new" feedback: response.data is json e.g. {"feedback":"Nice bpt!","csat_value":"Very satisfied","csat_score":5}
                                feedback.text = responseObject.feedback;
                                feedback.feedbackScoreText = responseObject.csat_value;
                                feedback.feedbackScore = responseObject.csat_score;
                            }
                            else {
                                // in case of "old" text only feedback, response.data is a string  e.g. 'Very goof bot !!!'
                                feedback.text = responseObject;
                            }

                            feedback.fetched = true;
                            if(cb) {
                                cb(param);
                            }
                            root.refreshTabIndices();
                        },
                        function(response) {
                            feedback.text = undefined;
                            feedback.err = true;
                            if(cb) {
                                cb(param);
                            }
                            root.toastr.error("Sorry, an error occurred while reading feedbacks. Please try again");
                        }
                    );
                }
            };

            function compareTime(a,b) {
                var aa = a.timestamp;
                var bb = b.timestamp;
                if (aa === bb) return 0;
                return ((aa < bb) ? 1 : -1);
            }

            function updateAccordion() {
                setTimeout(function() {
                    var acc = document.getElementsByClassName("accordion");
                    var i;
                    for (i = 0; i < acc.length; i++) {
                        acc[i].onclick = function() {
                            this.classList.toggle("active");
                            var panel = this.nextElementSibling;
                            if (panel.style.maxHeight){
                                panel.style.maxHeight = null;
                            }
                            else {
                                panel.style.maxHeight = '200px';
                            }
                        }
                    }
                    $('#feedbacksThisMonth').trigger("click");
                },50);
            }

            vm.applyFilter = function(data) {
                vm.nothingToShow = true;
                vm.feedbacks = [];
                vm.selected = '';
                var user = $('#filterUser').val();
                var dateFrom = vm.filter.dateFrom === '' ? -1 : (new Date(vm.filter.dateFrom)).getTime();
                var dateTo = vm.filter.dateTo === '' ? -1 : (new Date(vm.filter.dateTo)).getTime();
                vm.allFeedbacks.forEach(function(feedback) {
                    if (feedback.userName.indexOf(user) > -1) {
                        if (dateFrom === -1 || dateFrom <= feedback.timestamp) {
                            if (dateTo === -1 || dateTo >= feedback.timestamp) {
                                vm.feedbacks.push(feedback);
                                vm.nothingToShow = false;
                            }
                        }
                    }
                });
                if (data && data === true) {
                    $('#filterDateEnd').trigger("click");
                }
                setTimeout(function() {
                    vm.ready = true;
                    $scope.$apply();
                }, 100);
            };

            vm.clearFilter = function() {
                $('#filterUser').val('');
                vm.filter = {
                    dateFrom: '',
                    dateTo: ''
                };
                vm.applyFilter();
            };
            function dateDiff(num) {
                $('#filterDateStartVal').val($moment().subtract(num, 'days').format('l'));
                $('#filterDateEndVal').val('');
                vm.filter.dateFrom = $moment().subtract(num, 'days').format('l');
                vm.filter.dateTo = '';
            }

            vm.today = function() {
                dateDiff(0);
                vm.applyFilter();
                vm.selected = 'today';
            };

            vm.thisWeek = function() {
                dateDiff(7);
                vm.applyFilter();
                vm.selected = 'thisWeek';

            };
            vm.thisMonth = function() {
                dateDiff(30);
                vm.applyFilter();
                vm.selected = 'thisMonth';
            };

            vm.exportData = function() {
                if (vm.feedbacks.length > 5000) {
                    root.toastr.error("The maximum allowed feedbacks to export is 5000. Please narrow your search results with filters.");
                    return;
                }
                vm.toBeFetched = vm.feedbacks.length;
                vm.alreadyFetched = 1;
                root.toastr.success("processing export, please wait");
                $("#feedbacksExportProgress").css("width", "0%");
                root.modal.show();
                $('#feedbacksExportProgressContainer').show();

                vm.feedbacksIdsToFetch = {};
                for (const feedback of vm.feedbacks) {
                    vm.feedbacksIdsToFetch[feedback.id] = { ...feedback, fetched: false };
                }
                vm.dataToExport = {
                    feedbacks: []
                }
                fetchNext();
            }

            function fetchNext(retry = 0) {
                var feedbackToFetch = Object
                    .keys(vm.feedbacksIdsToFetch)
                    .filter((f) => !vm.feedbacksIdsToFetch[f].fetched)
                    .slice(0, 500);

                if (feedbackToFetch.length === 0) {
                    return exportDataFinalize();
                }

                $http.post('./feedback/all', {
                    ids: feedbackToFetch
                }, { timeout: 60000 }).then(
                    function({ data }) {
                        vm.alreadyFetched += data.length;
                        $("#feedbacksExportProgress").css("width", 100 * (vm.alreadyFetched / vm.toBeFetched) + "%");

                        data.forEach(function(f, i) {
                            var feedback = vm.feedbacksIdsToFetch[feedbackToFetch[i]];
                            feedback.fetched = true;
                            if (f.feedback !== undefined) {
                                vm.dataToExport.feedbacks.push({
                                    userName : feedback.userName,
                                    timestamp : feedback.timestampString,
                                    text: f.feedback,
                                    csat_value: f.csat_value,
                                    csat_score: f.csat_score
                                });
                            }
                            else {
                                vm.dataToExport.feedbacks.push({
                                    userName : feedback.userName,
                                    timestamp : feedback.timestampString,
                                    text: f
                                });
                            }
                        });
                        fetchNext();
                    },
                    function() {
                        if (retry >= 3) {
                            root.modal.hide();
                            $('#feedbacksExportProgressContainer').hide();
                            root.toastr.error("Sorry, an error occurred while reading feedbacks. Please try again");
                        } else {
                            fetchNext(retry + 1);
                        }
                    }
                );
            }

            function exportDataFinalize() {
                root.modal.hide();
                $('#feedbacksExportProgressContainer').hide();
                if (vm.feedbacks.length === 0) {
                    root.toastr.error("nothing to export");
                } else {

                    var a = document.createElement("a");
                    var keys = Object.keys(vm.dataToExport.feedbacks[0]);
                    var CSV = keys.join(', ') + '\n';
                    vm.dataToExport.feedbacks.forEach(function(item){
                        var values = [];
                        keys.forEach(function(key) {
                            values.push(item[key]);
                        });
                        CSV += '"' + values.join('","') + '"\n';
                    });
                    var file = new Blob([CSV], {type: 'text/plain'});
                    a.href = URL.createObjectURL(file);
                    a.download = 'feedbacks.csv';
                    a.click();
                }
            }
        }).filter('startFrom', function() {
            return (input, start) => {
                start = +start; //parse to int
                return input.slice(start);
            }
        });
})();
