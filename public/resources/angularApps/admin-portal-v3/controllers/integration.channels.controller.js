(function() {
    angular.module('adminPortalApp.controllers')
        .controller('channelsCtrl', function ($rootScope, $scope, $http, $timeout, $window) {

            /**************************************************************************************************
             * Globals
             ***************************************************************************************************/
            var root = $rootScope;
            var vm = this;

            vm.init = function () {
                vm.channels = [{
                    iconUrl: "/resources/images/webchat.png",
                    name: "Web Chat",
                    id: "WebChatChannel",
                    isEnabled: false,
                    actionName: "View",
                    drawerId: "webchatChannelDrawer"                    
                },
                {
                    iconUrl: "/resources/images/directline.png",
                    name: "DirectLine",
                    id: "DirectLineChannel",
                    isEnabled: false,
                    actionName: "View",
                    drawerId: "directLineChannelDrawer"                    
                },
                {
                    iconUrl: "/resources/images/msteams.png",
                    name: "Microsoft Teams",
                    id: "MsTeamsChannel",
                    isEnabled: true,
                    actionName: "View",
                    drawerId: "teamsChannelDrawer"

                },
                {
                    iconUrl: "/resources/images/sms.png",
                    name: "Twilio",
                    id: "SmsChannel",     
                    isEnabled: true,
                    actionName: "Edit",
                    drawerId: "twilioChannelDrawer"
                },
                {
                    iconUrl: "/resources/images/facebook.png",
                    name: "Facebook",
                    id: "FacebookChannel",
                    isEnabled: true,
                    actionName: "Edit",
                    drawerId: "facebookChannelDrawer"
                },                
                {
                    iconUrl: "/resources/images/telegram.png",
                    name: "Telegram",
                    id: "TelegramChannel",
                    isEnabled: true,
                    actionName: "Edit",
                    drawerId: "telegramChannelDrawer"
                },
                {
                    iconUrl: "/resources/images/alexa.png",
                    name: "Alexa (preview)",
                    id: "AlexaChannel",
                    isEnabled: true,
                    actionName: "Edit",
                    drawerId: "alexaChannelDrawer"
                },
                {
                    iconUrl: "/resources/images/whatsapp.png",
                    name: "WhatsApp (via Twilio - preview)",
                    id: "WhatsAppChannel",
                    isEnabled: true,
                    actionName: "Edit",
                    drawerId: "whatsAppChannelDrawer"
                },
                {
                    iconUrl: "/resources/images/omnichannel.svg",
                    name: "Omnichannel",
                    id: "Omnichannel",
                    isEnabled: true,
                    actionName: "Edit",
                    drawerId: "omnichannelDrawer"
                }];
                
                vm.channelIdToDrawerId = {};
                for (var i = 0; i < vm.channels.length; i++) {
                    vm.channelIdToDrawerId[vm.channels[i].id] = vm.channels[i].drawerId;
                }

                $('#deleteChannel').on('hidden.bs.modal', function (e) {
                    root.refreshTabIndices();
                });
                vm.generatingToken = false;

                vm.readBotProps();
                vm.readData();
            };

            vm.initFields = function() {
                vm.phoneNumber = "";
                vm.accountSID = "";
                vm.authToken = "";
                vm.telegramAccessToken = "";
                vm.facebookAccessToken = "";
                vm.facebookAppId = "";
                vm.facebookAppSecret = "";
                vm.facebookPageId = "";
                vm.alexaSkillId = "";
                vm.verifyToken = "Verify token will be available after you save";
                vm.serviceEndpointUri = "Service endpoint url will be available after you save";
                vm.callbackUrl = "https://facebook.botframework.com/api/v1/bots/" + $("#tenantName").val();                
                vm.app_id = $('#app_id').val();
                vm.iconTooLarge = false;
                vm.screenReaderText = null;
                vm.validIconFile  = true;
                vm.canUpload = false;
                $('#iconToUpload').val('');
                $('#iconToUpload').on("change", function(e) {
                    var reader = new FileReader();
                    reader.onload = function (onload) {
                        $scope.$apply(function() {
                            vm.iconUrl = onload.target.result;
                            vm.screenReaderText = null;

                            vm.iconTooLarge = e.target.files[0].size >= 30000;
                            if (vm.iconTooLarge) {
                                vm.screenReaderText = vm.screenReaderText || $('#iconTooLargeErrMsg').text();
                            }

                            vm.validIconFile = e.target.files[0].name.split('.').pop()  === 'png';
                            if (!vm.validIconFile) {
                                vm.screenReaderText = vm.screenReaderText || $('#validIconFileErrMsg').text();
                            }

                            vm.canUpload = !vm.iconTooLarge && vm.validIconFile;
                            if (vm.canUpload) {
                                vm.screenReaderText = vm.screenReaderText || `file ${e.target.files[0].name} selected`;
                            }
                        });
                    }
                    reader.readAsDataURL(e.target.files[0]);
                })
            }

            vm.browseFile = function() {
                var elem = document.getElementById('iconToUpload');
                if(elem && document.createEvent) {
                    var evt = document.createEvent("MouseEvents");
                    evt.initEvent("click", true, false);
                    elem.dispatchEvent(evt);
                }
            };

            vm.readBotProps = function () {
                root.modal.show();
                $http.get('./channels/botIcon/read').then(
                    function(response) {
                        root.modal.hide();
                        vm.iconUrl = response.data.iconUrl;
                    },
                    function(errorResponse) {
                        root.modal.hide();
                    });
            }

            vm.uploadIcon = function() {
                var form = new FormData();
                var filesArr = $('#iconToUpload')[0].files;                
                if (filesArr.length != 1) {
                    root.toastr.error('Icon file was not selected');
                    return;
                }
                if (filesArr[0].size >= 30000) {
                    root.toastr.error('Icon is too large. It should be 30K max');
                    $('#iconToUpload').val('');
                    return;
                }
                root.modal.show('Uploading Icon');
                var f = filesArr[0]
                form.append('icon', f);
                $http({
                    method: 'POST',
                    url: './channels/botIcon/upload',
                    data: form,
                    headers: { 'Content-Type': undefined},
                    transformRequest: angular.identity
                }).then(function successCallback(response) {
                    root.modal.hide();
                    $('#iconToUpload').val('');
                    if (response.status == 200) {
                        root.toastr.successWithTimeout('Please allow 30 minutes for changes to bot settings to be reflected in all regions. Changes to icons may take up to 24 hours.',
                                                       'Successfully uploaded bot icon', 15000);
                        $('#upload-file-info').html('');
                        vm.readBotProps();
                    }
                    else {
                        $('#iconToUpload').val('');
                        root.toastr.error('Failed to upload bot icon');
                    }
                }, function errorCallback(err)
                {
                    $('#iconToUpload').val('');
                    root.toastr.error('Failed to upload bot icon');
                    root.modal.hide();
                });
        
            }

            vm.readData = function() {
                root.modal.show();
                vm.initFields();
                vm.editing = false;
                $http.get('./channels/channel/read').then(
                    function(response) {
                        if (response.status === 200) {
                            vm.existingChannels = response.data;
                            for (var c = 0; c < vm.channels.length; c++) {
                                var channelId = vm.channels[c].id;
                                var channelData = vm.existingChannels[channelId];
                                vm.channels[c].active = (channelData) ? true : false
                                vm.channels[c].class =  (!vm.channels[c].isEnabled) ? "hb-toggle hb-toggle-checked-disabled hb-toggle-checked" : 
                                                        (vm.channels[c].active ? "hb-toggle hb-toggle-checked" : "hb-toggle")
                                if (channelData) {
                                    if (channelId === 'MsTeamsChannel') {
                                        vm.channels[c].testUrl = "https://teams.microsoft.com/l/chat/0/0?users=28:" + vm.app_id;
                                    }
                                    else if (channelId === 'FacebookChannel') {
                                        vm.channels[c].testUrl = "https://www.messenger.com/t/" + channelData.properties.pages[0].id
                                    }
                                }
                            }
                            root.modal.hide();
                        } else {
                            root.toastr.error("Sorry, an error occurred while reading channels. Please try again");
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        root.toastr.error("Sorry, an error occurred while reading channels. Please try again");
                    }
                );
            }

            vm.activeToggle = function(channel) {
                if (channel.isEnabled) {
                    if (channel.active) {
                        vm.showDelete(channel);
                    }
                    else {
                        vm.editing = false;
                        vm.initFields();
                        root.openDrawer(vm.channelIdToDrawerId[channel.id]);
                    }
                }
            }

            vm.createTeamsChannel = function() {                
                var id = "MsTeamsChannel";
                channelInfo = {
                    location: 'global',
                    properties: {
                        channelName: id,
                        properties: {
                            isEnabled: true
                        }
                    }
                };
                if (vm.editing) {
                    vm.modifyChannel(id, channelInfo);
                }   
                else {
                    vm.cancelEdit(vm.channelIdToDrawerId[id]);
                    vm.createChannel(id, channelInfo);
                }
            }

            vm.createOmniChannel = function() {                
                var id = "Omnichannel";
                channelInfo = {
                    location: 'global',
                    properties: {
                        channelName: id,
                        properties: {
                            isEnabled: true
                        }
                    }
                };
                if (vm.editing) {
                    vm.modifyChannel(id, channelInfo);
                }   
                else {
                    vm.cancelEdit(vm.channelIdToDrawerId[id]);
                    vm.createChannel(id, channelInfo);
                }
            }

            vm.createTwilioChannel = function() {
                vm.newValidateTwilio = {};                
                if (!vm.validateTwilio()) {
                    return;
                }
                var id = "SmsChannel";
                channelInfo = {
                    location: 'global',
                    properties: {
                        channelName: id,
                        properties: {
                            phone: vm.phoneNumber,
                            accountSID: vm.accountSID,
                            authToken: vm.authToken,
                            isEnabled: true
                        }
                    }
                };
                if (vm.editing) {
                    vm.modifyChannel(id, channelInfo);
                }
                else {
                    vm.cancelEdit(vm.channelIdToDrawerId[id]);
                    vm.createChannel(id, channelInfo);
                }
            }

            vm.createWhatsAppChannel = function() {
                vm.newValidateTwilio = {};                
                if (!vm.validateTwilio()) {
                    return;
                }
                var id = "WhatsAppChannel";
                channelInfo = {
                    location: 'adapter',
                    properties: {
                        channelName: id,
                        properties: {
                            phone: vm.phoneNumber,
                            accountSID: vm.accountSID,
                            authToken: vm.authToken,
                            serviceEndpointUri: vm.serviceEndpointUri,
                            isEnabled: true
                        }
                    }
                };
                if (vm.editing) {
                    vm.modifyChannel(id, channelInfo);
                }
                else {
                    var item = vm.channels.find(function(c) {return c.id === id}); 
                    vm.generatingToken = true;
                    vm.cancelEdit(vm.channelIdToDrawerId[id]);
                    vm.createChannel(id, channelInfo, function() {
                        vm.showEditItemDrawer(item, function() {
                            vm.generatingToken = false;
                        });
                    });
                }
            }

            vm.createFacebookChannel = function() {
                vm.newValidateFacebook = {};
                if (!vm.validateFacebook()) {
                    return;
                }
                var id = "FacebookChannel";
                channelInfo = 
                {
                    location: 'global',
                    properties: {
                        channelName: id,
                        properties: {
                            verifyToken: vm.verifyToken,
                            appId: vm.facebookAppId,
                            appSecret: vm.facebookAppSecret,
                            isEnabled: true,
                            pages : [{
                                id: vm.facebookPageId,
                                accessToken: vm.facebookAccessToken
                            }]
                        }
                    }
                };
                if (vm.editing) {
                    vm.modifyChannel(id, channelInfo);
                }
                else {
                    var item = vm.channels.find(function(c) {return c.id === id}); 
                    vm.generatingToken = true;
                    vm.createChannel(id, channelInfo, function() {
                        vm.showEditItemDrawer(item, function() {
                            vm.generatingToken = false;
                        });
                    });
                }
            }

            vm.createTelegramChannel = function() {
                vm.newValidateTelegram = {};                
                if (!vm.validateTelegram()) {
                    return;
                }
                var id = "TelegramChannel";
                channelInfo = {
                    location: 'global',
                    properties: {
                        channelName: id,
                        properties: {
                            accessToken: vm.telegramAccessToken,
                            isEnabled: true
                        }
                    }
                };
                if (vm.editing) {
                    vm.modifyChannel(id, channelInfo);
                }
                else {
                    vm.cancelEdit(vm.channelIdToDrawerId[id]);
                    vm.createChannel(id, channelInfo);
                }
            }

            vm.createAlexaChannel = function() {
                vm.newValidateAlexa = {};                
                if (!vm.validateAlexa()) {
                    return;
                }
                var id = "AlexaChannel";
                channelInfo = {
                    location: 'global',
                    properties: {
                        channelName: id,
                        properties: {
                            alexaSkillId: vm.alexaSkillId,
                            isEnabled: true
                        }
                    }
                };
                if (vm.editing) {
                    vm.modifyChannel(id, channelInfo);
                }
                else {
                    var item = vm.channels.find(function(c) {return c.id === id}); 
                    vm.generatingToken = true;
                    vm.createChannel(id, channelInfo, function() {
                        vm.showEditItemDrawer(item, function() {
                            vm.generatingToken = false;
                        });
                    });
                }
            }


            vm.createChannel = function(id, data, completedFunc) {                
                var name = vm.channels.find(function(c) {return c.id === id}).name; 
                root.modal.show("Creating " + name);
                $http.post('./channels/channel/' + id, data).then(
                    function(response) {
                        root.toastr.success('Successfully created channel.');
                        vm.readData();
                        root.modal.hide();
                        if (completedFunc) {
                            completedFunc();
                        }
                    },
                    function(response) {
                        root.modal.hide();
                        root.toastr.error("Sorry, an error occurred while creating channel. Please try again");
                        vm.readData();
                    }
                )
            }

            vm.modifyChannel = function(id, data) {
                var name = vm.channels.find(function(c) {return c.id === id}).name; 
                root.modal.show("Modifying " + name);
                vm.cancelEdit(vm.channelIdToDrawerId[id]);
                $http.put('./channels/channel/' + id, data).then(
                    function(response) {
                        root.modal.hide();
                        root.toastr.success('Successfully modified channel.');
                        vm.readData();
                    },
                    function(response) {
                        root.modal.hide();
                        root.toastr.error("Sorry, an error occurred while modifying channel. Please try again");
                        vm.readData();
                    }
                )
            }

            vm.validateTwilio = function() {
                var errFieldId = null;
                if (vm.phoneNumber.trim() === "") {
                    vm.newValidateTwilio.phoneNumber = "Phone Number is required";
                    errFieldId = errFieldId || '#ap-twilio-phoneNumber';
                }
                if (vm.accountSID.trim() === "") {
                    vm.newValidateTwilio.accountSID = "Account SID is required";
                    errFieldId = errFieldId || '#ap-twilio-accountSID';
                }
                if (vm.authToken.trim() === "") {
                    vm.newValidateTwilio.authToken = "Auth token is required";
                    errFieldId = errFieldId || '#ap-twilio-authToken';
                }

                if (errFieldId) {
                    $(errFieldId).trigger("focus");
                    return false;
                }

                return true;
            }

            vm.validateTelegram = function() {
                var isValid = true;
                if (vm.telegramAccessToken.trim() === "") {
                    vm.newValidateTelegram.telegramAccessToken = "Accesss Token required";
                    isValid = false;
                }
                return isValid;
            }

            vm.validateAlexa = function() {
                var isValid = true;
                if (vm.alexaSkillId.trim() === "") {
                    vm.newValidateAlexa.alexaSkillId = "Alexa Skill Id required";
                    isValid = false;
                }
                return isValid;
            }

            vm.validateFacebook = function() {
                var errFieldId = null;
                if (vm.facebookAppId.trim() === "") {
                    vm.newValidateFacebook.facebookAppId = "Facebook AppId is required";
                    errFieldId = errFieldId || '#ap-facebookappid';
                }
                if (vm.facebookAppSecret.trim() === "") {
                    vm.newValidateFacebook.facebookAppSecret = "Facebook App Secret is required";
                    errFieldId = errFieldId || '#ap-facebookappsecret';
                }
                if (vm.facebookPageId.trim() === "") {
                    vm.newValidateFacebook.facebookPageId = "Facebook Page Id is required";
                    errFieldId = errFieldId || '#ap-facebookpageid';
                }
                if (vm.facebookAccessToken.trim() === "") {
                    vm.newValidateFacebook.facebookAccessToken = "Facebook Page Access Token is required";
                    errFieldId = errFieldId || '#ap-facebookpageaccesstoken';
                }

                if (errFieldId) {
                    $(errFieldId).trigger("focus");
                    return false;
                }

                return true;
            }

            vm.testChannel = function(item)  {
                window.open(item.testUrl, '_blank');
            }

            vm.showEditItemDrawer = function (item, done) {
                root.modal.show();
                vm.editing = true;
                $http.get('./channels/channel/' + item.id).then(
                    function(response){
                        root.openDrawer(vm.channelIdToDrawerId[item.id]);
                        vm.phoneNumber = response.data.phone;
                        vm.accountSID = response.data.accountSID;
                        vm.authToken = response.data.authToken;
                        vm.telegramAccessToken = response.data.accessToken;
                        vm.alexaSkillId = response.data.alexaSkillId;
                        vm.app_id = response.data.app_id;
                        vm.app_secret = response.data.app_secret;
                        vm.verifyToken = response.data.verifyToken;
                        vm.serviceEndpointUri = response.data.serviceEndpointUri;
                        vm.callbackUrl = response.data.callbackUrl;
                        vm.facebookAppId = response.data.appId;
                        vm.facebookAppSecret = response.data.appSecret;
                        if (response.data.pages) {
                            vm.facebookPageId = response.data.pages[0].id;
                            vm.facebookAccessToken = response.data.pages[0].accessToken;
                        }
                        if (response.data.sites) {
                            vm.webchat_secret = response.data.sites[0].key;
                        }
                        if (done) {
                            done();
                        }
                        root.modal.hide();
                    },
                    function(response) {
                        root.toastr.error("Sorry, an error occurred while editing channel. Please try again");
                        root.modal.hide();
                        if (done) {
                            done();
                        }
                    }
                );
            }

            vm.showDelete = function(channel) {
                if (channel) {
                    vm.channelToDelete = channel;
                    $('#deleteChannel').modal();
                }
            };

            vm.executeDelete = function() {
                root.modal.show("Deleting " + vm.channelToDelete.name + " channel");
                $http.delete('./channels/channel/' + vm.channelToDelete.id).then(
                    function(response) {
                        root.toastr.success('Successfully deleted channel.');
                        root.modal.hide();
                        vm.readData();
                    },    
                    function(response) {
                        root.modal.hide();
                        root.toastr.error("Sorry, an error occurred while deleting channel. Please try again");
                        vm.readData();
                    });
            }

            vm.cancelEdit = function(drawerId) {
                root.closeDrawer(drawerId);
            };
        });
})();
