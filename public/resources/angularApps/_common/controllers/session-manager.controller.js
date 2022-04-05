function registerSessionManager(env) {
    angular.module(env + '.controllers')
        .controller('sessionManagerCtrl', function ($rootScope, $scope) {
            $scope.idle = false;
            $rootScope.timeLeft = -1;
            function checkSessionStatus() {
                setTimeout(function() {
                    var cookies = {};
                    document.cookie.split(';').forEach(function(item) {var s = item.trim().split('='); cookies[s[0]] = s[1];});
                    var isIdle = !cookies.hasOwnProperty('healthbot.idle');
                    var isTimeout = !cookies.hasOwnProperty('healthbot.timeout');

                    if (isTimeout) {
                        $('.session-to-outer').remove();
                        $('body').prepend('' +
                            '<div class="session-to-outer">' +
                            '<div class="session-to-middle">' +
                            '<div class="session-inner" style="z-index: 9999">' +
                            '<img src="/resources/images/logo-white.png" width="50px" height="50px"><br><br>' +
                            'Your session has timed out and is no longer active.<br>' +
                            'Please <span class="clickable-text" onclick="location.href = location.href">click here</span> to log in again' +
                            '</div>' +
                            '</div>' +
                            '</div>')
                    }
                    else if (isIdle) {
                        const currTime = new Date().getTime();
                        $rootScope.timeLeft = Math.max(Math.ceil((cookies["healthbot.timeout"] - currTime) / 1000), 0);
                        if (!$scope.idle) {
                            $('.session-to-outer').remove();
                            $('body').prepend(''+
                                '<div class="session-to-outer">' +
                                '<div class="session-to-middle">' +
                                '<div class="session-inner" style="z-index: 9998">' +
                                '<img src="/resources/images/logo-white.png" width="100px" height="100px"><br><br>' +
                                '<span class="timeout-counter">Your session has been idle too long and is about to expire in <span id="time-to-timeout">' + $rootScope.timeLeft + '</span> seconds</span><br><br>' +
                                'Would you like to continue working?<br><br>' +
                                '<button class="hb-btn hb-btn-primary" onclick="$.post(\'/activity\') && $(\'.session-to-outer\').remove()">Resume</button>' +
                                '</div>' +
                                '</div>' +
                                '</div>')

                        } else {
                            $('#time-to-timeout').html($rootScope.timeLeft);
                        }
                        $scope.idle = true;


                    }
                    else {
                        $('.session-to-outer').remove();
                        $scope.idle = false;
                    }

                    if (!isTimeout) {
                        checkSessionStatus();
                    }
                }, 1000);
            }
            checkSessionStatus();
        });
};
