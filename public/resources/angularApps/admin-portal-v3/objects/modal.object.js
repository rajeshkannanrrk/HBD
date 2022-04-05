angular.module('adminPortalApp.objects')
    .factory('ModalObject', [function () {
        function ModalObject()
        {
            var modalObject = this;
            _createModalObject(modalObject);
        }

        return ModalObject;

        ////////////////////////////

        function _createModalObject(modalObject) {
            var modalObj = modalObject;
            modalObj.progressCounter = 0;

            modalObj.showGlobal = function(phrase) {
                $('.spinner').show();
                $('.spinner .spinner-label').html(phrase)
            };

            modalObj.hideGlobal = function() {
                $('.spinner').hide();
            };

            modalObj.show = function(phrase) {
                if (!phrase) {
                    phrase = "Loading";
                }
                if (this.progressCounter <= 0) {
                    $('.application-body').append('<div class="processing-blocker"><div>'+phrase+'</div></div>');
                    this.progressCounter = 1;
                }
                else {
                    this.progressCounter++;
                    if (phrase) {
                        $('.processing-blocker div').html(phrase);
                    }
                }
            };
            modalObj.hide = function() {
                if (this.progressCounter > 1) {
                    this.progressCounter--;
                }
                else {
                    $('.processing-blocker').remove();
                    this.progressCounter = 0;
                }
            };
            modalObj.showProgress = function(phrase) {
                if (this.progressCounter <= 0) {
                    $('.application-body').append('<div class="processing-blocker"><div>'+phrase+'</div></div>');
                    this.progressCounter = 1;
                }
                else {
                    this.progressCounter++;
                    if (phrase) {
                        $('.processing-blocker div').html(phrase);
                    }
                }
            };
            modalObj.hideProgress = function() {
                if (this.progressCounter > 1) {
                    this.progressCounter--;
                }
                else {
                    $('.processing-blocker').remove();
                    this.progressCounter = 0;
                }
            };

        }
    }]);
