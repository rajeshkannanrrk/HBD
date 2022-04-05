var GenericElementFormCtrl = function($scope, element, windows, scenarios, blobs, loclizationSettings, existingLocalizationStrings, $uibModalInstance, $uibModal, $autocomplete, $fhir, $http) {

    $scope.master = element;
    $scope.element = window.angular.copy(element);

    $scope.dataTypes = ["string", "boolean", "number", "time", "choice", "multi-choice", "attachment", "object"];

    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);

    $scope.scenarios = [];

    $scope.blobs = [];

    $scope.loclizationSettings = loclizationSettings;
    $scope.localizedStrings = [{
        stringId: $scope.element.stringId,
        "en-us": $scope.element.text
    }];
    $scope.localizedString = {
        _tenant: {
            stringId: $scope.element.stringId,
            "en-us": $scope.element.text
        }
    };

    // if we are loading choice or multi-choice type, we set $scope.choices, and change the dataType according to choiceType
    if ($scope.element.designer.listStyle !== undefined) {
        $scope.choices = typeof ($scope.element.dataType) === "object" ? JSON.stringify($scope.element.dataType) : $scope.element.dataType;
        if($scope.element.choiceType === "multi-choice") {
            $scope.element.dataType = "multi-choice";
        } else {
            $scope.element.dataType = "choice";
        }
    }

    $scope.initListStyles = () => {
        $scope.listStyles = [
            {name:"none", value:0},
            {name:"inline", value:1},
            {name:"list", value:2},
            {name:"button", value:3},
            {name:"auto", value:4}
        ];
        if ($scope.element.dataType === "multi-choice") {
            $scope.listStyles.push({name:"checkbox", value:5});
        }
    };
    $scope.initListStyles();
    
    $scope.monacoEditorOptions = {
        language: "javascript",
        lineNumbers: false
    };

    $scope.onDataTypeChanged = () => {
        $scope.initListStyles();
        $scope.initSelectedListStyle();
    }

    $scope.monacoEditorOptions.fhir = { def: [], name: "" };
    $fhir.definitionsLoaded.then(function () {
        $scope.monacoEditorOptions.fhir.def  = $fhir.monacoDefinitions;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });

    $scope.initSelectedListStyle = () => {
        // if we have chosen a listStyle we show it, otherwise we set default for each choice
        if ($scope.element.designer.listStyle != undefined) {
            $scope.selectedListStyle = $scope.listStyles[$scope.element.designer.listStyle];
        } else {
            if ($scope.element.dataType === "multi-choice") {
                $scope.selectedListStyle = $scope.listStyles[5];
            } else if ($scope.element.dataType === "choice") {
                $scope.selectedListStyle = $scope.listStyles[3];
            }
        }
    }
    $scope.initSelectedListStyle();
    if (scenarios) {
        $.each(scenarios.data, function(index, value) {
            if (value.scenario_trigger && value.scenario_trigger.length > 0 &&
                // don't show duplicate triggers. an error will be promped during save
                $scope.scenarios.indexOf(value.scenario_trigger) === -1) {
                $scope.scenarios.push(value.scenario_trigger);
            }
        });
    }

    if (blobs) {
        $scope.blobs = blobs.data;
    }


    $scope.$watch('element.visible', function (newValue) {
        if(newValue === "") {
            $scope.element.visible = undefined;
        }
    });

    $scope.$watch('element.text', function (newValue) {
        if (newValue === "") {
            $scope.element.text = undefined;
        }
    });

    $scope.$watch('element.onInit', function (newValue) {
        if (newValue === "") {
            $scope.element.onInit = undefined;
        }
    });

    $scope.refreshStrings = function(partOfString) {
        return $http.get('./specificLocalizedStrings?partOfString=' + partOfString).then(
            function(res) {
                $scope.localizedStrings = res.data && res.data.length > 0 ? ([{
                    stringId: "",
                    "en-us": ""
                }]).concat(res.data) : [];
            },
            function(httpError) {
                console.error(httpError);
            }
        );
    };

    $scope.refreshStrings("");
    $scope.saveNewString = function(select) {
        select = select || {};
        var sc = $scope;
        select.refreshing = true;
        $http.post('./saveNewString', {value: select.search}).
        then(function onSuccess(response) {
            var data = response.data;
            var status = response.status;

            if (status > 299) {
                window.toastr.error("Sorry, an error occurred while adding localized string. Please try again later");
            } else {
                sc.localizedString._tenant = data;
                sc.localizedStringSelected();
                select.refreshing = false;
                select.close();
            }
        }, function onError(response) {
            select.refreshing = false;
            console.error(response);
        });
    };

    $scope.localizedStringSelected = function() {
        $scope.element.stringId = $scope.localizedString._tenant.stringId;
        $scope.element.text = $scope.localizedString._tenant["en-us"];
    };

    $scope.openAttachmentPopup = function() {
        var modalInstance =  $uibModal.open({
            templateUrl: '/resources/templates/cardsForm.html',
            controller : CardsFormCtrl,
            size :'lg',
            backdrop : "static",
            resolve : {
                element : function() {
                    return $scope.element;
                },
                variables :function() {
                    return $scope.variables;
                },
                blobs : function() {
                    return $scope.blobs;
                },
                loclizationSettings : function() {
                    return $scope.loclizationSettings;
                }
            }
        });

        modalInstance.result.then(function (tempElement) {
            window.angular.copy(tempElement, $scope.element);
        }, function () {
        });
    }

    $scope.openEntityPopup = function() {
        var modalInstance =  $uibModal.open({
            templateUrl: '/resources/templates/entityForm.html',
            controller : EntityFormCtrl,
            size :'lg',
            backdrop : "static",
            resolve : {
                element : function() {
                    return $scope.element;
                },
                variables :function() {
                    return $scope.variables;
                }
            }
        });

        modalInstance.result.then(function (tempElement) {
            window.angular.copy(tempElement, $scope.element);
        }, function () {
        });
    }

    $scope.attachmentButton = function() {
        return ($scope.element.hasOwnProperty('attachment')) ? "Edit Cards" :"Cards";
    }

    $scope.entityButton = function() {
        return ($scope.element.hasOwnProperty('entity')) ? "Edit Message Metadata" :"Message Metadata";
    }

    $scope.md5 = function(d){result = M(V(Y(X(d),8*d.length)));return result.toLowerCase()};function M(d){for(var _,m="0123456789ABCDEF",f="",r=0;r<d.length;r++)_=d.charCodeAt(r),f+=m.charAt(_>>>4&15)+m.charAt(15&_);return f}function X(d){for(var _=Array(d.length>>2),m=0;m<_.length;m++)_[m]=0;for(m=0;m<8*d.length;m+=8)_[m>>5]|=(255&d.charCodeAt(m/8))<<m%32;return _}function V(d){for(var _="",m=0;m<32*d.length;m+=8)_+=String.fromCharCode(d[m>>5]>>>m%32&255);return _}function Y(d,_){d[_>>5]|=128<<_%32,d[14+(_+64>>>9<<4)]=_;for(var m=1732584193,f=-271733879,r=-1732584194,i=271733878,n=0;n<d.length;n+=16){var h=m,t=f,g=r,e=i;f=md5_ii(f=md5_ii(f=md5_ii(f=md5_ii(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_ff(f=md5_ff(f=md5_ff(f=md5_ff(f,r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+0],7,-680876936),f,r,d[n+1],12,-389564586),m,f,d[n+2],17,606105819),i,m,d[n+3],22,-1044525330),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+4],7,-176418897),f,r,d[n+5],12,1200080426),m,f,d[n+6],17,-1473231341),i,m,d[n+7],22,-45705983),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+8],7,1770035416),f,r,d[n+9],12,-1958414417),m,f,d[n+10],17,-42063),i,m,d[n+11],22,-1990404162),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+12],7,1804603682),f,r,d[n+13],12,-40341101),m,f,d[n+14],17,-1502002290),i,m,d[n+15],22,1236535329),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+1],5,-165796510),f,r,d[n+6],9,-1069501632),m,f,d[n+11],14,643717713),i,m,d[n+0],20,-373897302),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+5],5,-701558691),f,r,d[n+10],9,38016083),m,f,d[n+15],14,-660478335),i,m,d[n+4],20,-405537848),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+9],5,568446438),f,r,d[n+14],9,-1019803690),m,f,d[n+3],14,-187363961),i,m,d[n+8],20,1163531501),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+13],5,-1444681467),f,r,d[n+2],9,-51403784),m,f,d[n+7],14,1735328473),i,m,d[n+12],20,-1926607734),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+5],4,-378558),f,r,d[n+8],11,-2022574463),m,f,d[n+11],16,1839030562),i,m,d[n+14],23,-35309556),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+1],4,-1530992060),f,r,d[n+4],11,1272893353),m,f,d[n+7],16,-155497632),i,m,d[n+10],23,-1094730640),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+13],4,681279174),f,r,d[n+0],11,-358537222),m,f,d[n+3],16,-722521979),i,m,d[n+6],23,76029189),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+9],4,-640364487),f,r,d[n+12],11,-421815835),m,f,d[n+15],16,530742520),i,m,d[n+2],23,-995338651),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+0],6,-198630844),f,r,d[n+7],10,1126891415),m,f,d[n+14],15,-1416354905),i,m,d[n+5],21,-57434055),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+12],6,1700485571),f,r,d[n+3],10,-1894986606),m,f,d[n+10],15,-1051523),i,m,d[n+1],21,-2054922799),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+8],6,1873313359),f,r,d[n+15],10,-30611744),m,f,d[n+6],15,-1560198380),i,m,d[n+13],21,1309151649),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+4],6,-145523070),f,r,d[n+11],10,-1120210379),m,f,d[n+2],15,718787259),i,m,d[n+9],21,-343485551),m=safe_add(m,h),f=safe_add(f,t),r=safe_add(r,g),i=safe_add(i,e)}return Array(m,f,r,i)}function md5_cmn(d,_,m,f,r,i){return safe_add(bit_rol(safe_add(safe_add(_,d),safe_add(f,i)),r),m)}function md5_ff(d,_,m,f,r,i,n){return md5_cmn(_&m|~_&f,d,_,r,i,n)}function md5_gg(d,_,m,f,r,i,n){return md5_cmn(_&f|m&~f,d,_,r,i,n)}function md5_hh(d,_,m,f,r,i,n){return md5_cmn(_^m^f,d,_,r,i,n)}function md5_ii(d,_,m,f,r,i,n){return md5_cmn(m^(_|~f),d,_,r,i,n)}function safe_add(d,_){var m=(65535&d)+(65535&_);return(d>>16)+(_>>16)+(m>>16)<<16|65535&m}function bit_rol(d,_){return d<<_|d>>>32-_}

    $scope.ok = function () {
        if ($scope.element.text && !$scope.element.stringId) {
            $scope.element.stringId = "stringId_" + $scope.md5($scope.element.text).substr(0, 16);
        }

        // according to promptForm.html, suggestions field ISN'T relevant in ['choice', 'multi-choice', 'attachment', 'object']
        // explicitly set it to undefined is necessary otherwise it will be displayed as part of the prompt
        if (['choice', 'multi-choice', 'attachment', 'object'].includes($scope.element.dataType)){
            $scope.element.suggestions = undefined;
        }

        // if the dataType is in ('choice', 'multi-choice') we want to set it to the selected choices
        if ($scope.element.dataType === 'choice' || $scope.element.dataType === 'multi-choice') {
            $scope.element.choiceType = $scope.element.dataType;
            $scope.element.dataType = $scope.choices;
            $scope.element.designer.listStyle = $scope.selectedListStyle.value;
        } else {
            $scope.element.choiceType = undefined;
            $scope.element.designer.listStyle = undefined;
        }
        $scope.element.maxRetries = $scope.element.maxRetries || undefined;

        $uibModalInstance.close($scope.element);
    };
    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
};

/**************************************************************************************************************************************************/

var DatasourceElementFormCtrl = function($scope, element, windows, existingLocalizationStrings, $uibModalInstance, $autocomplete, $dataConnections, $authenticationProviders, $fhir) {
    $scope.master = element;
    $scope.element = window.angular.copy(element);
    $scope.connectionType = 'custom';
    $scope.customDataConnectionName = "Use step specific connection details";
    $scope.noAuthenticationProviderName = "Don’t require end user authentication";

    // *** auto migrate old steps - begin
    // TODO: remove this step after the integration feature phase 1 got released
    if ($scope.element.provider || $scope.element.url) {
        $scope.element.authenticationProvider = ($scope.element.provider && $scope.element.provider !== 'custom') ? $scope.element.provider : $scope.noAuthenticationProviderName;
        $scope.element.urlBase = "'" + $scope.element.url + "'";
        $scope.element.payload = $scope.element.input;
    }
    delete $scope.element.provider;
    delete $scope.element.input;
    delete $scope.element.typeId;
    delete $scope.element.onInit;
    delete $scope.element.sinceDate;
    delete $scope.element.url;
    // *** auto migrate old steps - end

    if ($scope.element.method) {
        $scope.element.method = $scope.element.method.toUpperCase();
    }
    // registering variables for autocomplete support
    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);

    // filling missing fields to prevent UI gaps
    if (!$scope.element.hasOwnProperty('dataConnection'))           { $scope.element.dataConnection             = $scope.customDataConnectionName; }
    if (!$scope.element.hasOwnProperty('authenticationProvider'))   { $scope.element.authenticationProvider     = $scope.noAuthenticationProviderName; }
    if (!$scope.element.hasOwnProperty('urlBase'))                  { $scope.element.urlBase                    = "'https://...'"; }
    if (!$scope.element.hasOwnProperty('urlPath'))                  { $scope.element.urlPath                    = ""; }
    if (!$scope.element.hasOwnProperty('urlParams'))                { $scope.element.urlParams                  = ""; }
    if (!$scope.element.hasOwnProperty('fhirAction'))               { $scope.element.fhirAction                 = "Read"; }
    if (!$scope.element.hasOwnProperty('fhirResource'))             { $scope.element.fhirResource               = "Account"; }
    if (!$scope.element.hasOwnProperty('contentType'))              { $scope.element.contentType                = "raw"; }
    if (!$scope.element.hasOwnProperty('method'))                   { $scope.element.method                     = "GET"; }
    if (!$scope.element.hasOwnProperty('headers'))                  { $scope.element.headers                    = ""; }
    if (!$scope.element.hasOwnProperty('payload'))                  { $scope.element.payload                    = ""; }
    if (!$scope.element.hasOwnProperty('opJson'))                   { $scope.element.opJson                     = true; }
    if (!$scope.element.hasOwnProperty('opResolveWithFullResponse')){ $scope.element.opResolveWithFullResponse  = false; }
    if ($scope.element.dataConnection === "")                       { $scope.element.dataConnection             = $scope.customDataConnectionName ; }
    // creating placeholder for the data connection data (to be replaced once the real data received from server)
    $scope.dataConnections = [{name: $scope.customDataConnectionName, type: $scope.customDataConnectionName}];
    $scope.dataConnectionsDefinitions = {};
    if ($scope.element.dataConnection.length > 0) {
        $scope.dataConnections.push({name: $scope.element.dataConnection, title: $scope.element.dataConnection + " (Custom)"});
    }
    $scope.dataConnections.forEach(function (item) {
        $scope.dataConnectionsDefinitions[item.name] = {
            name: $scope.element.dataConnection,
            base_url: $scope.element.urlBase,
            auth_provider: $scope.noAuthenticationProviderName,
            description: "",
            static_headers: [],
            type: "custom"
        };
    });

    // creating a list of authenticationProviders. this will be filled with the real data during the step load process.
    $scope.authenticationProviders = [$scope.noAuthenticationProviderName];

    // creating static lists of options for methods and content types
    $scope.methods = ["GET","PUT","POST","PATCH","DELETE"];
    $scope.contentTypes = ["raw", "form-data", "x-www-form-urlencoded"];

    // creating monacoEditorOptions objects
    $scope.monacoEditorOptions          = { language: "javascript", lineNumbers: false };
    $scope.monacoEditorOptionsPayload   = { language: "javascript", lineNumbers: false, fhir: { def: [], name: "" } };

    // reading the fhir api actions and resources list
    $scope.fhirActions = [];
    $scope.fhirResources = [];

    $fhir.apiLoaded.then(function () {
        $scope.fhirActions = $fhir.api;
        $scope.fhirResources = $fhir.resources;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });

    $scope.fhirDefinitions = [];
    $fhir.definitionsLoaded.then(function () {
        $scope.fhirDefinitions = $fhir.monacoDefinitions;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });

    /**
     * this function will handle the path update of a fhir based data connection accoding the current selected api definition
     *
     * @param $scope
     */
    var loading = true;
    function setFhirPath($scope) {
        var actionDef = $scope.fhirActions.filter(function(item) { return item.name === $scope.element.fhirAction ; })[0];
        if (actionDef) {
            var path = [];
            actionDef.structure.forEach(function(item) {
                switch (item) {
                    case "$base":
                        break;
                    case "$type":
                        path.push("\'" + $scope.element.fhirResource + "\'");
                        break;
                    case "$id":
                        path.push("\' + /* replace with id */ + \'");
                        break;
                    case "$vid":
                        path.push("\' + /* replace with id */ + \'");
                        break;
                    default:
                        path.push(item);
                }
            });
            if (loading) {
                loading = false;
            }
            else {
                $scope.element.urlPath = ("'/' + " + path.join('/')).replace(/\' \+ \'/g,'').replace(/\'\/\' \+/g,'/\' + ').replace(/\'\/\'/g,'/');
                if ($scope.element.urlPath.endsWith(" + '")) {
                    $scope.element.urlPath = $scope.element.urlPath.substr(0, $scope.element.urlPath.length - 4);
                }
            }



        }
    }

    /**
     * this function will handle the basic params settings for a fhir call, if it is relevant.
     *
     * @param $scope
     */
    function setFhirBasicParams($scope) {
        var actionDef = $scope.fhirActions.filter(function(item) { return item.name === $scope.element.fhirAction ; })[0];
        if (actionDef) {
            var params = [];
            Object.keys(actionDef.params).forEach(function(key) {
                if (actionDef.params[key].required) {
                    params.push(key + '=' + actionDef.params[key].value);
                }
            });
            $scope.element.urlParams = $scope.element.urlParams || "'" + params.join('&') + "'";
        }
    }

    // reading the data connections list from server
    $dataConnections.dataLoaded.then(function () {
        $scope.dataConnections = [{
            name: $scope.customDataConnectionName,
            title: $scope.customDataConnectionName
        }];
        $dataConnections.dataConnections.forEach(function(item) {
            if (!item.auth_provider || item.auth_provider.length === 0) {
                item.auth_provider = $scope.noAuthenticationProviderName;
            }
            $scope.dataConnections.push({
                name: item.name,
                title: item.name + (item.type === 'custom' ? " (Custom)" : " (FHIR)")
            });
            $scope.dataConnectionsDefinitions[item.name] = item;

        });
        if (!$scope.dataConnectionsDefinitions[$scope.element.dataConnection]) {
            window.toastr.warning("The selected data connection is not defined");
        }
        else {
            if ($scope.element.dataConnection === $scope.customDataConnectionName) {
                setViewByDataConnectionType('none');
            }
            else if ($scope.dataConnectionsDefinitions[$scope.element.dataConnection].type === "custom") {
                $scope.element.authenticationProvider = $scope.dataConnectionsDefinitions[$scope.element.dataConnection].auth_provider;
                $scope.element.urlBase = $scope.dataConnectionsDefinitions[$scope.element.dataConnection].base_url;
                setViewByDataConnectionType('custom');
            }
            else { // fhir
                $scope.element.urlBase = $scope.dataConnectionsDefinitions[$scope.element.dataConnection].base_url;
                setFhirPath($scope);
                setFhirBasicParams($scope);
                setViewByDataConnectionType('fhir');
                refreshPayloadLanguageSystem($scope.element.fhirResource);
            }
        }
    }, function(err) {
        console.error('error reading data connections list from server. ' + JSON.stringify(err));
    });

    // reading the authentication providers list from server
    $authenticationProviders.dataLoaded.then(function () {
        $authenticationProviders.authenticationProviders.forEach(function(item) {
            $scope.authenticationProviders.push(item.name);
        });
    }, function(err) {
        console.error('error reading authentication providers list from server. ' + JSON.stringify(err));
    });

    /**
     * this function will enable/disable a field container
     * @param name
     * @param available
     */
    function setFieldContainerAvailability(name, available) {
        setTimeout(function() {$('#' + name).css('pointer-events', available ? 'auto' : 'none').css('opacity', available ? '1' : '0.2');}, 10);
    }

    /**
     * this function will handle the view settings according the type of the data connection type
     * @param type
     */
    function setViewByDataConnectionType(type) {
        switch (type) {
            case "none":
            case "custom":
                $scope.connectionType = 'custom';
                setFieldContainerAvailability('field-authentication-provider', type === 'none');
                setFieldContainerAvailability('field-method', true);
                setFieldContainerAvailability('field-contentType', $scope.element.method !== "" && $scope.element.method.toLowerCase() !== "get");
                setFieldContainerAvailability('field-url-base', type === 'none');
                setFieldContainerAvailability('field-url-path', true);
                setFieldContainerAvailability('field-url-query-parameters', true);
                setFieldContainerAvailability('field-payload', $scope.element.method !== "" && $scope.element.method.toLowerCase() !== "get");
                refreshPayloadLanguageSystem(null);
                break;
            case "fhir":
                $scope.connectionType = 'fhir';
                setFieldContainerAvailability('field-authentication-provider', false);
                setFieldContainerAvailability('field-url-base', false);
                setFieldContainerAvailability('field-url-path', true);
                setFieldContainerAvailability('field-url-query-parameters', true);
                setFieldContainerAvailability('field-payload', $scope.element.method !== "" && $scope.element.method.toLowerCase() !== "get");
                refreshPayloadLanguageSystem($scope.element.resourceName);
                break;
        }
    }

    /**
     * this function will change the monaco editor options for the payload field.
     * @param fhirResourceName
     */
    function refreshPayloadLanguageSystem(fhirResourceName) {
        if (!fhirResourceName) {
            $scope.monacoEditorOptionsPayload.fhir.def  = [];
            $scope.monacoEditorOptionsPayload.fhir.name = "";
        }
        else {
            $scope.monacoEditorOptionsPayload.fhir.def  = $scope.fhirDefinitions;
            $scope.monacoEditorOptionsPayload.fhir.name = $scope.element.fhirResource;
        }
    }

    /**
     * this function will handle data connection selection change.
     * it will work for 3 modes
     * 1. selected nothing (specific definition per this step)
     * 2. selected pre-defined custom api
     * 3. selected pre-defined fhir api
     */
    $scope.dataConnectionSelectionChanged = function() {
        if ($scope.element.dataConnection === $scope.customDataConnectionName) {
            setViewByDataConnectionType('none');
            refreshPayloadLanguageSystem(null);
            $scope.methodSelectionChanged();
        }
        else if ($scope.dataConnectionsDefinitions[$scope.element.dataConnection].type === 'custom') {
            $scope.element.urlBase = "'" + $scope.dataConnectionsDefinitions[$scope.element.dataConnection].base_url + "'";
            $scope.element.urlPath = "";
            $scope.element.urlParams = "";
            $scope.element.authenticationProvider = $scope.dataConnectionsDefinitions[$scope.element.dataConnection].auth_provider;
            setViewByDataConnectionType('custom');
            refreshPayloadLanguageSystem(null);
            $scope.methodSelectionChanged();
        }
        else { // fhir
            $scope.element.payload = '/* fill the missing fields */\nFHIR({\n  "resourceType": "' + $scope.element.fhirResource + '"\n});';
            $scope.element.urlBase = "'" + $scope.dataConnectionsDefinitions[$scope.element.dataConnection].base_url + "'";
            setFhirPath($scope);
            setFhirBasicParams($scope);
            $scope.element.authenticationProvider = $scope.dataConnectionsDefinitions[$scope.element.dataConnection].auth_provider;
            setViewByDataConnectionType('fhir');
            refreshPayloadLanguageSystem($scope.element.fhirResource);
        }
    };

    /**
     * this function will handle https method selection change (available only for non-fhir data connection.
     * it will affect the availability of the content type and payload field.
     */
    $scope.methodSelectionChanged = function(selectedMethod) {
        if (selectedMethod) {
            $scope.element.method = selectedMethod;
        }
        setFieldContainerAvailability('field-content-type', $scope.element.method.toLowerCase() !== 'get');
        setFieldContainerAvailability('field-payload', $scope.element.method.toLowerCase() !== 'get')
    };
    $scope.methodSelectionChanged();

    /**
     * this function will handle fhir action selection change and the corresponding change to path and query params
     */
    $scope.fhirActionSelectionChanged = function() {
        $scope.element.method = $scope.fhirActions.filter(function(item) { return item.name === $scope.element.fhirAction } )[0].method.toUpperCase();
        setFieldContainerAvailability('field-payload', $scope.element.method !== "" && $scope.element.method !== "GET");
        setFhirPath($scope);
        setFhirBasicParams($scope);
    };

    /**
     * this function will handle fhir resource selection change.
     * it will fetch the relevant resource monaco definitions and will refresh the payload container autocomplete.
     */
    $scope.fhirResourceSelectionChanged = function() {
        $scope.element.payload = '/* fill the missing fields */\nFHIR({\n  "resourceType": "' + $scope.element.fhirResource + '"\n});';
        setFhirPath($scope);
        refreshPayloadLanguageSystem($scope.element.fhirResource);
    };

    /**
     * this function handles the "ok" button pressed.
     * it should validate that the step is legit and if it is, process the save.
     */
    $scope.ok = function () {
        var connectionType = $scope.dataConnectionsDefinitions[$scope.element.dataConnection].type;

        if ($scope.element.dataConnection === $scope.customDataConnectionName) {
            $scope.element.dataConnection = "";
        }
        if ($scope.element.authenticationProvider === $scope.noAuthenticationProviderName) {
            delete $scope.element.authenticationProvider;
        }
        if (connectionType === 'custom') {
            delete $scope.element.fhirAction;
            delete $scope.element.fhirResource;
            if ($scope.element.method === 'GET') {
                delete $scope.element.contentType;
                delete $scope.element.payload;
            }
        }
        else { // fhir
            delete $scope.element.contentType;
            delete $scope.element.urlBase;
        }
        $scope.element.method = $scope.element.method.toLowerCase();
        $uibModalInstance.close($scope.element);
    };

    /**
     * this function handles the "cancel" button pressed.
     */
    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
};
/********************************************************************************************************************* */

var GlobalContextElementFormCtrl = function($scope, element, windows, existingLocalizationStrings, $uibModalInstance, $autocomplete) {
    $scope.master = element;
    $scope.element = window.angular.copy(element);
    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);

    $scope.operations = ['Get', 'Set'];

    $scope.monacoEditorOptions = {
        language: "javascript",
        lineNumbers: false
    };

    $scope.ok = function () {
        if ($scope.element.contextName.endsWith('.')) {
            window.toastr.error("Context name cannot end with a dot.");
        }
        else if ($scope.element.operation === 'Get' && (!$scope.element.variable || $scope.element.variable === '')) {
            window.toastr.error("Local Variable Name cannot be blank.");
        }
        else if ($scope.element.operation === 'Set' && (!$scope.element.contextValue || $scope.element.contextValue === '')) {
            window.toastr.error("Context Value cannot be blank.");
        }
        else {
            if ($scope.element.operation === 'Get') {
                $scope.element.contextValue = '';
            }
            if ($scope.element.operation === 'Set') {
                $scope.element.variable = '';
            }

            $uibModalInstance.close($scope.element);
        }
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
};
/********************************************************************************************************************* */
var CardsFormCtrl = function($scope, element, variables, blobs, loclizationSettings, $uibModal, $uibModalInstance, $fhir) {

    $scope.master = element;
    $scope.element = window.angular.copy(element);
    $scope.element.layout = $scope.element.layout || "vertical";

    if ($scope.element.attachment) {
        $scope.element.attachment = Array.isArray(element.attachment) ? element.attachment : [element.attachment];
    }
    else {
        $scope.element.attachment = [];
    }
    $scope.layoutTypes = ["vertical","carousel"];

    $scope.cardCaption = function(index) {
        var card = $scope.element.attachment[index]
        if (typeof(card) == 'string') {
            return `Image`;
        }
        switch(card.type) {
            case 'Carousel':
                return 'Dynamic Cards';
            case 'ThumbnailCard':
            case 'HeroCard':
                return `${card.type} : ${card.title} : ${card.subtitle} : ${card.image}`
            case 'AdaptiveCard':
                return `${card.type}`

        }
        return (card.type);
    }

    $scope.cardTitle = function(index) {
        var card = $scope.element.attachment[index];
        if (typeof(card) == 'string') {
            return card;
        }
        switch(card.type) {
            case 'Carousel':
                return card.carouselCode;
            case 'ThumbnailCard':
            case 'HeroCard':
                return `${card.type} : ${card.title} : ${card.subtitle}`;
            case 'AdaptiveCard':
                return card.cardCode;

        }
        return (card.type);
    }

    $scope.cardIcon = function(index) {
        var card = $scope.element.attachment[index]
        if (typeof(card) == 'string') {
            return 'hb-icons hb-icons-LivingImage';
        }
        switch(card.type) {
            case 'AdaptiveCard':
                return 'hb-icons hb-icons-TextCallout';
            case 'Carousel':
                return 'hb-icons hb-icons-CodeEdit';
        }
        return 'hb-icons hb-icons-ContactCard';

    }

    $scope.addCard = function() {
        $scope.editCard(-1);
    }

    $scope.editCard = function(index) {
        var modalInstance =  $uibModal.open({
            templateUrl: '/resources/templates/attachmentForm.html',
            controller : AttachmentFormCtrl,
            size :'lg',
            backdrop : "static",
            resolve : {
                card : function() {
                    if (index < 0) {
                        return "";
                    }
                    return $scope.element.attachment[index];
                },
                variables :function() {
                    return variables;
                },
                blobs : function() {
                    return blobs;
                },
                loclizationSettings : function() {
                    return loclizationSettings;
                }
            }
        });

        modalInstance.result.then(function (tempElement) {
            if (index < 0) {
                $scope.element.attachment.push(tempElement);
            }
            else {
                $scope.element.attachment[index] = tempElement;
            }
        }, function () {
        });
    }

    $scope.removeEmptyCards = function() {
        if ($scope.element.attachment  && $scope.element.attachment.length === 0) {
            delete $scope.element.attachment;
        }
    }

    $scope.removeCard = function(index) {
        $scope.element.attachment.splice(index,1);
        $scope.removeEmptyCards();
    }

    $scope.moveUp = function(i) {
        var tmp = $scope.element.attachment[i];
        $scope.element.attachment[i] = $scope.element.attachment[i-1];
        $scope.element.attachment[i-1] = tmp;
    }

    $scope.moveDown = function(i) {
        var tmp = $scope.element.attachment[i];
        $scope.element.attachment[i] = $scope.element.attachment[i+1];
        $scope.element.attachment[i+1] = tmp;
    }

    $scope.ok = function () {
        $scope.removeEmptyCards();
        $uibModalInstance.close($scope.element);
    }

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}

/********************************************************************************************************************* */
var AttachmentFormCtrl = function($scope, $http, card, variables, blobs, loclizationSettings, $uibModalInstance, $fhir) {

    $scope.variables = variables.concat(blobs.entries);

    $scope.attachmentTypes = ["Image","HeroCard","ThumbnailCard", "AdaptiveCard","Dynamic Cards"];

    $scope.actionTypes = ["openUrl","imBack","postBack","call","playAudio","playVideo","showImage","downloadFile"];

    $scope.actionHints = ["https://google.com","Postback Data","tel:+01-555-4444","https://audio.wav","https://video.mp4","https://image.png","https://downloadfile"];

    $scope.getHint = function(type) {
        var i = $scope.actionTypes.indexOf(type);
        return $scope.actionHints[i];
    };

    $scope.oldActionsUI = false;

    $scope.getAttachmentFromType = function() {
        if (typeof(card) == 'string') {
            return "Image";
        }
        if (card.type == 'Carousel') {
            return 'Dynamic Cards';
        }
        return card.type;
    }

    $scope.card = card;

    // DON'T CHANGE THE INDENTATION OF THE CODE BELOW
    $scope.sampleCarouselCode = "(function(){\n\
    return [\n\
        new builder.ThumbnailCard().text('Card 1').title('Card 1').subtitle('Card 1').\n\
        buttons([\n\
            builder.CardAction.postBack(session,'hi1','Say Hi'),\n\
            builder.CardAction.postBack(session,'bye1','Say Bye') \n\
        ]),\n\
        new builder.ThumbnailCard().text('Card 2').title('Card 2').subtitle('Card 2').\n\
        buttons([ \n\
            builder.CardAction.postBack(session,'hi2','Say Hi'), \n\
            builder.CardAction.postBack(session,'bye2','Say Bye')\n\
        ])\n\
    ] \n\
    })()\n";

    $scope.selectedAttachmentType = $scope.getAttachmentFromType();
    // Init with a sample code for carousel if empty
    $scope.carouselCode = (card && card.carouselCode && card.carouselCode.length > 0) ?
                           card.carouselCode :
                           $scope.sampleCarouselCode;

    if ($scope.selectedAttachmentType == 'Image') {
        $scope.image = card;
    } else {
        $scope.title = card.title;
        $scope.subtitle = card.subtitle;
        $scope.image = card.image;
        $scope.buttons = card.buttons;
        $scope.actions = card.actions;
        $scope.cardCode = card.cardCode;
    }

    $scope.getImage = function() {
        if (!$scope.image) {
            return "/resources/images/photo.png";
        }
        var image = ($scope.image && $scope.image.indexOf("conversation.resourcesUrl") >= 0) ?  eval($scope.image.replace("resourcesUrl}", "\"" + $('#resourcesUrl').val()+"\"")) :
            eval(("\"" + $scope.image + "\""));
        return image;
    }

    $scope.uploadSingleImage = function(e) {
        var form = new FormData();
        var filesArr = $('#resourceToUpload')[0].files;
        if (filesArr.length != 1) {
            return;
        }
        $scope.loadingImage = true;
        for (var i = 0 ; i < filesArr.length; i++) {
            var f = filesArr[i]
            form.append('f_' + i, f);
        }
        $http({
            method: 'POST',
            url: '../resources/files/upload',
            data: form,
            headers: { 'Content-Type': undefined},
            transformRequest: angular.identity
        }).then(function successCallback(response) {
            $scope.loadingImage = false;
            if (response.status == 200) {
                window.toastr.success(e.files[0].name + " uploded succesfully");
                $scope.image = 'conversation.resourcesUrl + "/' + filesArr[0].name + '"';
                $scope.variables.push(filesArr[0].name);
            }
            else {
                window.toastr.error(response.data);
            }
        }, function errorCallback(err)
        {
            window.toastr.error("Error uloading image " + filesArr[0].name);
            $scope.loadingImage = false;
        });
    }

    $scope.monacoEditorOptions = {
        language: "javascript",
        lineNumbers: false
    }

    $scope.monacoEditorOptionsLines = {
        language: "javascript"
    }

    $scope.monacoEditorOptions.fhir = { def: [], name: "" };
    $scope.monacoEditorOptionsLines.fhir = { def: [], name: "" };
    $fhir.definitionsLoaded.then(function () {
        $scope.monacoEditorOptions.fhir.def  = $fhir.monacoDefinitions;
        $scope.monacoEditorOptionsLines.fhir.def  = $fhir.monacoDefinitions;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });

    $scope.addAction = function() {
        if  (!$scope.actions) {
            $scope.actions = [];
        }
        $scope.actions.push({
            type:'',
            parameter : '',
            caption:'',
            captionStringId:''
        })
    };

    $scope.removeAction = function(index) {
        $scope.actions.splice(index,1);
        $scope.selectedLocalizedStrings.actions.splice(index,1);
    }

    $scope.loclizationSettings = loclizationSettings;
    $scope.localizedStrings = [];
    $scope.selectedLocalizedStrings = {
        title:{
            _tenant: {
                stringId: card && card.titleStringId,
                "en-us": card && card.title
            }
        },
        subtitle: {
            _tenant: {
                stringId: card && card.subtitleStringId,
                "en-us": card && card.subtitle
            }
        },
        actions: []
    };
    if ($scope.actions) {
        $scope.selectedLocalizedStrings.actions = [];
        $scope.actions.forEach(function(action) {
            $scope.selectedLocalizedStrings.actions.push({
                _tenant: {
                    stringId: action.captionStringId,
                    "en-us": action.caption
                }
            })
        });
    }

    $scope.saveNewString = function(select, type, index) {
        select = select || {};
        var sc = $scope;
        select.refreshing = true;
        $http.post('./saveNewString', {value: select.search}).
        then(function onSuccess(response) {
            var data = response.data;
            var status = response.status;

            if (status > 299) {
                window.toastr.error("Sorry, an error occurred while adding localized string. Please try again later");
            } else {
                if (type === 'title') {
                    sc.selectedLocalizedStrings.title._tenant = data;
                } else if (type === 'subtitle') {
                    sc.selectedLocalizedStrings.subtitle._tenant = data;
                } else if (type === 'caption') {
                    sc.selectedLocalizedStrings.actions[index]._tenant = data;
                }
                sc.localizedStringSelected(type, index);
                select.refreshing = false;
                select.close();
            }
        }, function onError(response) {
            select.refreshing = false;
            console.error(response);
        });
    };

    $scope.refreshStrings = function(partOfString) {
        $http.get('./specificLocalizedStrings?partOfString=' + partOfString).then(
            function(res) {
                $scope.localizedStrings = res.data && res.data.length > 0 ? ([{
                    stringId: "",
                    "en-us": ""
                }]).concat(res.data) : [];
            },
            function(httpError) {
                console.error(httpError);
            }
        );
    };

    $scope.refreshStrings("");

    $scope.localizedStringSelected = function(type, index) {
        if (type === 'title') {
            $scope.titleStringId = $scope.selectedLocalizedStrings.title._tenant.stringId;
            $scope.title = $scope.selectedLocalizedStrings.title._tenant["en-us"];
        } else if (type === 'subtitle') {
            $scope.subtitleStringId = $scope.selectedLocalizedStrings.subtitle._tenant.stringId;
            $scope.subtitle = $scope.selectedLocalizedStrings.subtitle._tenant["en-us"];
        } else if (type === 'caption') {
            $scope.actions[index].captionStringId = $scope.selectedLocalizedStrings.actions[index]._tenant.stringId;
            $scope.actions[index].caption = $scope.selectedLocalizedStrings.actions[index]._tenant["en-us"];
        }
    };

    $scope.md5 = function(d){result = M(V(Y(X(d),8*d.length)));return result.toLowerCase()};function M(d){for(var _,m="0123456789ABCDEF",f="",r=0;r<d.length;r++)_=d.charCodeAt(r),f+=m.charAt(_>>>4&15)+m.charAt(15&_);return f}function X(d){for(var _=Array(d.length>>2),m=0;m<_.length;m++)_[m]=0;for(m=0;m<8*d.length;m+=8)_[m>>5]|=(255&d.charCodeAt(m/8))<<m%32;return _}function V(d){for(var _="",m=0;m<32*d.length;m+=8)_+=String.fromCharCode(d[m>>5]>>>m%32&255);return _}function Y(d,_){d[_>>5]|=128<<_%32,d[14+(_+64>>>9<<4)]=_;for(var m=1732584193,f=-271733879,r=-1732584194,i=271733878,n=0;n<d.length;n+=16){var h=m,t=f,g=r,e=i;f=md5_ii(f=md5_ii(f=md5_ii(f=md5_ii(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_ff(f=md5_ff(f=md5_ff(f=md5_ff(f,r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+0],7,-680876936),f,r,d[n+1],12,-389564586),m,f,d[n+2],17,606105819),i,m,d[n+3],22,-1044525330),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+4],7,-176418897),f,r,d[n+5],12,1200080426),m,f,d[n+6],17,-1473231341),i,m,d[n+7],22,-45705983),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+8],7,1770035416),f,r,d[n+9],12,-1958414417),m,f,d[n+10],17,-42063),i,m,d[n+11],22,-1990404162),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+12],7,1804603682),f,r,d[n+13],12,-40341101),m,f,d[n+14],17,-1502002290),i,m,d[n+15],22,1236535329),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+1],5,-165796510),f,r,d[n+6],9,-1069501632),m,f,d[n+11],14,643717713),i,m,d[n+0],20,-373897302),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+5],5,-701558691),f,r,d[n+10],9,38016083),m,f,d[n+15],14,-660478335),i,m,d[n+4],20,-405537848),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+9],5,568446438),f,r,d[n+14],9,-1019803690),m,f,d[n+3],14,-187363961),i,m,d[n+8],20,1163531501),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+13],5,-1444681467),f,r,d[n+2],9,-51403784),m,f,d[n+7],14,1735328473),i,m,d[n+12],20,-1926607734),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+5],4,-378558),f,r,d[n+8],11,-2022574463),m,f,d[n+11],16,1839030562),i,m,d[n+14],23,-35309556),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+1],4,-1530992060),f,r,d[n+4],11,1272893353),m,f,d[n+7],16,-155497632),i,m,d[n+10],23,-1094730640),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+13],4,681279174),f,r,d[n+0],11,-358537222),m,f,d[n+3],16,-722521979),i,m,d[n+6],23,76029189),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+9],4,-640364487),f,r,d[n+12],11,-421815835),m,f,d[n+15],16,530742520),i,m,d[n+2],23,-995338651),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+0],6,-198630844),f,r,d[n+7],10,1126891415),m,f,d[n+14],15,-1416354905),i,m,d[n+5],21,-57434055),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+12],6,1700485571),f,r,d[n+3],10,-1894986606),m,f,d[n+10],15,-1051523),i,m,d[n+1],21,-2054922799),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+8],6,1873313359),f,r,d[n+15],10,-30611744),m,f,d[n+6],15,-1560198380),i,m,d[n+13],21,1309151649),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+4],6,-145523070),f,r,d[n+11],10,-1120210379),m,f,d[n+2],15,718787259),i,m,d[n+9],21,-343485551),m=safe_add(m,h),f=safe_add(f,t),r=safe_add(r,g),i=safe_add(i,e)}return Array(m,f,r,i)}function md5_cmn(d,_,m,f,r,i){return safe_add(bit_rol(safe_add(safe_add(_,d),safe_add(f,i)),r),m)}function md5_ff(d,_,m,f,r,i,n){return md5_cmn(_&m|~_&f,d,_,r,i,n)}function md5_gg(d,_,m,f,r,i,n){return md5_cmn(_&f|m&~f,d,_,r,i,n)}function md5_hh(d,_,m,f,r,i,n){return md5_cmn(_^m^f,d,_,r,i,n)}function md5_ii(d,_,m,f,r,i,n){return md5_cmn(m^(_|~f),d,_,r,i,n)}function safe_add(d,_){var m=(65535&d)+(65535&_);return(d>>16)+(_>>16)+(m>>16)<<16|65535&m}function bit_rol(d,_){return d<<_|d>>>32-_}

    $scope.ok = function () {
        if ($scope.selectedAttachmentType == 'Image') {
            card = $scope.image;
        }
        else if ($scope.selectedAttachmentType == 'HeroCard' || $scope.selectedAttachmentType == 'ThumbnailCard') {
            Array.isArray($scope.actions) && $scope.actions.forEach(function(action) {
                if (action.caption && !action.captionStringId) {
                    action.captionStringId = "stringId_" + $scope.md5(action.caption).substr(0, 16);
                }
            });
            card = {
                type: $scope.selectedAttachmentType,
                title: $scope.title,
                titleStringId: ($scope.titleStringId) || ($scope.title && "stringId_" + $scope.md5($scope.title).substr(0, 16)),
                subtitle: $scope.subtitle,
                subtitleStringId: ($scope.subtitleStringId) || ($scope.subtitle && "stringId_" + $scope.md5($scope.subtitle).substr(0, 16)),
                buttons: $scope.buttons,
                actions: $scope.actions,
                image: $scope.image
            }
        }
        else if ($scope.selectedAttachmentType == 'AdaptiveCard') {
            card = {
                type: $scope.selectedAttachmentType,
                cardCode: $scope.cardCode
            }
        }
        else if ($scope.selectedAttachmentType == 'Dynamic Cards') {
            card = {
                type: 'Carousel',
                carouselCode: $scope.carouselCode
            }
        }
        $uibModalInstance.close(card);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}

/********************************************************************************************************************* */
var EntityFormCtrl = function($scope, element, variables, $uibModalInstance, $fhir) {

    $scope.master = element;
    $scope.element = window.angular.copy(element);
    $scope.variables = variables;

    $scope.actionHelp = "Attach any JavaScript object to message send to the client"

    $scope.monacoEditorOptions = {
        language: "javascript"
    };

    $scope.monacoEditorOptions.fhir = { def: [], name: "" };
    $fhir.definitionsLoaded.then(function () {
        $scope.monacoEditorOptions.fhir.def  = $fhir.monacoDefinitions;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });

    $scope.ok = function () {
        $uibModalInstance.close($scope.element);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}

/********************************************************************************************************************* */

var ActionElementFormCtrl = function($scope, element, windows, snippets, existingLocalizationStrings, $uibModalInstance, $autocomplete, $fhir) {

    $scope.master = element;
    $scope.element = window.angular.copy(element);

    $scope.dataTypes = ["string", "boolean", "number", "time", "choice"];

    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);

    $scope.actionHelp = "Use the following variable notation.\n" +
                        "scenario.var = scenario local variables\n" +
                        "user.var = user data variables\n" +
                        "conversation.var = conversation variables\n\n" +
                        "Available object to use in the code:\n" +
                        "require, session, moment, builder, underscore\n\n" +
                        "Hit 'Ctrl+Space' for autocomplete\n\n" +
                        "Example: scenario.welcomeMessage = \"Hello \" + scenario.name";

    $scope.editorOptions = {
        language: "javascript"
    };

    $scope.editorOptions.fhir = { def: [], name: "" };
    $fhir.definitionsLoaded.then(function () {
        $scope.editorOptions.fhir.def  = $fhir.monacoDefinitions;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });

    $.each(snippets.data, function(index, value){
        $scope.variables.push('@'+value.name+'()');
    });

    $scope.variables.push("fnext()");


    $scope.$watch('element.onInit', function (newValue) {
        if (newValue === "") {
            $scope.element.onInit = undefined;
        }
    });


    $scope.ok = function () {

        $uibModalInstance.close($scope.element);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

};

var WaitElementFormCtrl = function($scope, element, windows, snippets, existingLocalizationStrings, $uibModalInstance, $autocomplete) {
    $scope.master = element;
    $scope.element = window.angular.copy(element);
    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);
    $scope.editorOptions = {
        language: "javascript"
    };

    $.each(snippets.data, function(index, value){
        $scope.variables.push('@'+value.name+'()');
    });

    $scope.$watch('element.time', function (newValue) {
        if (newValue === "") {
            $scope.element.time = undefined;
        }
    });

    $scope.ok = function () {
        $uibModalInstance.close($scope.element);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
};

var SwitchElementFormCtrl = function($scope, element, windows, $uibModalInstance, existingLocalizationStrings, $autocomplete, $fhir) {

    $scope.master = element;
    $scope.element = window.angular.copy(element);

    $scope.monacoEditorOptions = {
        language: "javascript",
        lineNumbers: false
    };

    $scope.monacoEditorOptions.fhir = { def: [], name: "" };
    $fhir.definitionsLoaded.then(function () {
        $scope.monacoEditorOptions.fhir.def  = $fhir.monacoDefinitions;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });


    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);

    if (!$scope.element.cases || $scope.element.cases.length === 0) {
        $scope.element.cases = [{value:'', targetStepId:''}]
    }

    $scope.addCase = function() {
        if (!$scope.element.cases) {
            $scope.element.cases = [];
        }
        $scope.element.cases.push({value:'', targetStepId:''});
        var id = '#value' + ($scope.element.cases.length - 1);
        setTimeout(function(){$(id).trigger("focus");}, 10)

    }
    $scope.keyDownHandlerSwitch =function (event, i) {
        // enter
        if (event.keyCode == 13) {
            event.preventDefault();
            if (i === ($scope.element.cases.length - 1)) {
                $scope.addCase();
            }
            return false;
        }
        // down
        else if (event.keyCode == 40 && i<$scope.element.cases.length-1)  {
            event.preventDefault();
            var id = '#value' + (i+1);
            $(id).trigger("focus");
            return false;
        }
        // up
        else if (event.keyCode == 38 && i>0)  {
            event.preventDefault();
            var id = '#value' + (i-1);
            $(id).trigger("focus");
            return false;
        }
    }

    Array.prototype.unique2 = function()
    {
        var n = {},r=[];
        for(var i = 0; i < this.length; i++)
        {
            if (!n[this[i].value])
            {
                n[this[i].value] = true;
                r.push(this[i].value);
            }
        }
        return r;
    }

    $scope.removeCase = function(index) {
        $scope.element.cases.splice(index,1);
        if ($scope.element.cases.length === 0) {
            $scope.addCase();
        }
    }


    $scope.ok = function () {

        var unique = $scope.element.cases.unique2();
        if (unique.length != $scope.element.cases.length) {
            window.toastr.error("Case values must be unique");
        }
        else {
            $uibModalInstance.close($scope.element);
        }
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
};

/********************************************************************************************************************* */
var LUISElementFormCtrl = function($scope, $http, element, windows, $uibModalInstance, existingLocalizationStrings, $autocomplete, $fhir) {
    $scope.master = element;
    $scope.element = window.angular.copy(element);
    $http.get('./luismodels').then(
        function(response) {
            $scope.luisModels = response.data.luisModels;
            $scope.luisModelNames = Object.keys($scope.luisModels);
            $scope.luisURL = response.data.luisURL;

            updateElementModelURI($scope.luisModels);
        },
        function(httpError) {
            $scope.luisModels = [];
            $scope.luisURL = "";
        }
    );
    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);
    $scope.variables.push("https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/{appid}?subscription-key={subscriptionkey}");

    $scope.monacoEditorOptions = {
        language: "javascript",
        lineNumbers: false
    };

    $scope.monacoEditorOptions.fhir = { def: [], name: "" };
    $fhir.definitionsLoaded.then(function () {
        $scope.monacoEditorOptions.fhir.def  = $fhir.monacoDefinitions;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });


    $scope.selectModel = function () {
        element.modelName = $('#modelname').val();
        updateElementModelURI(this.luisModels);
    };
    function updateElementModelURI(luisModels) {
        if (element.modelName && element.modelName.length > 0) {
            var model = luisModels[element.modelName];
            if (model) {
                setTimeout(function() {
                    $('#luisModelFix').val($scope.luisURL.replace("%s",model.region).replace("%s",model.application_id).replace("%s",model.subscription_key));
                }, 1);
            }
        }
    }

    $scope.ok = function () {

        $uibModalInstance.close($scope.element);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
};

/********************************************************************************************************************* */
var EndWithResultElementFormCtrl = function($scope, element, windows, $uibModalInstance, existingLocalizationStrings, $autocomplete, $fhir) {
    $scope.master = element;
    $scope.element = window.angular.copy(element);

    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);

    $scope.monacoEditorOptions = {
        language: "javascript"
    };

    $scope.endScopes = ["scenario","conversarion"];

    $scope.monacoEditorOptions.fhir = { def: [], name: "" };
    $fhir.definitionsLoaded.then(function () {
        $scope.monacoEditorOptions.fhir.def  = $fhir.monacoDefinitions;
    }, function(err) {
        console.error('error reading fhir definitions from server. ' + JSON.stringify(err));
    });

    $scope.ok = function () {
        $uibModalInstance.close($scope.element);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
};

/********************************************************************************************************************* */
var InvokeSkillElementFormCtrl = function($scope, $http, element, windows, $uibModalInstance, existingLocalizationStrings, $autocomplete) {
    $scope.master = element;
    $scope.element = window.angular.copy(element);
    var skills = null;
    $http.get('./skills').then(
        function(response) {
            $scope.skills = response.data.skills;
            skills = response.data.skills;
            if (element.skillId) {
                element.skillManifestUrl = skills.find((skill) => skill.name === element.skillId)?.manifestUrl;
                $scope.element.skillManifestUrl = element.skillManifestUrl;
                delete element['skillId'];
                delete $scope.element['skillId'];
            }
        },
        function(httpError) {
            $scope.skills = [];
        }
    );
    $scope.variables = $autocomplete.variables(windows, existingLocalizationStrings);

    $scope.ok = function () {
        $uibModalInstance.close($scope.element);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
};

