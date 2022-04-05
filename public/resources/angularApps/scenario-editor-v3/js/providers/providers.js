    /**
 * Mapping for getting specific data according to element type
 */


function BaseHandler() {

}

BaseHandler.prototype.getElementFormCtrl = function () {
    return GenericElementFormCtrl;
};

BaseHandler.prototype.postEditOK = function () {
};

BaseHandler.prototype.postEditCancel = function () {
};


BaseHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#a1dbff');
};

BaseHandler.prototype.canSwitchSides = function() {
    return false;
};

BaseHandler.prototype.getDefaultText = function (step) {
    if (step.label && step.label.trim().length > 0) {
        return step.label;
    }
};

BaseHandler.prototype.getCaption = function() {
    return undefined;
};

/************************************************************************************************************************************/

function PromptHandler() {

}

PromptHandler.prototype = new BaseHandler();

PromptHandler.prototype.constructor = BaseHandler;

PromptHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "prompt",
        "dataType":"boolean",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top   
        },
        "text": "",
        "variable":"",
        "submitTitle": "Submit"
    };
};

PromptHandler.prototype.getClass = function() {
    return "QuestionInputElement";
};


PromptHandler.prototype.addEndpoints = function(instance, element) {
    instance.addEndpoint(element.id, {
        maxConnections: -1,
        dropOptions: { hoverClass: "hover", activeClass: "active" },
        isTarget: true,
        cssClass: element.id + "-top"
    }, { 
        anchor: "TopCenter",
    });
    instance.addEndpoint(element.id, { 
        isSource: true, 
        dragOptions: {},
        cssClass: element.id + "-bottom"
    }, { 
        anchor: "BottomCenter",
    });
};

PromptHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }
    var text = "";
    if (step.text && step.text.trim().length > 0) {
        text = step.text;
    }
    else {
        if (typeof step.attachment  == 'string') {
            text = step.attachment;
        }
        else {
            if (step.attachment) {
                if (step.attachment.title) {
                    text = step.attachment.title;
                }
                else if (step.attachment.subtitle) {
                    text = step.attachment.subtitle;
                }
                else {
                    text = step.attachment.type;
                }
            }
        }
    }
    return text;
};

PromptHandler.prototype.connectStep = function(instance, window, step) {
    instance.connect({
        source: window, 
        target: $('#' + step.designer.next),
        anchors: ["BottomCenter", "TopCenter"]
    });
};

PromptHandler.prototype.makeConnection = function(srcElement, connectionInfo) {
    srcElement.designer.next = connectionInfo.targetId;
};

// ReSharper disable once UnusedParameter
PromptHandler.prototype.detachConnection = function(srcElement, connectionInfo) {
    srcElement.designer.next = undefined;
};

PromptHandler.prototype.getTemplate = function() {
    return "/resources/templates/promptForm.html";
};

PromptHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#b7df2d');
};

/************************************************************************************************************************************/

function BranchHandler() {

}

BranchHandler.prototype = new BaseHandler();

BranchHandler.prototype.constructor = BaseHandler;

BranchHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "branch",
        "condition":"false",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top   
        }
    };
};

BranchHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }
    return step.condition;
};

BranchHandler.prototype.getClass = function() {
    return "ChoiceElement";
};

BranchHandler.prototype.addEndpoints = function(instance, element) {
    instance.addEndpoint(element.id, {
        maxConnections: -1,
        dropOptions: { hoverClass: "hover", activeClass: "active" },
        isTarget: true,
        cssClass: element.id + "-top"
    }, { 
        anchor: "TopCenter" 
    });
    
    var noEndpoint = instance.addEndpoint(element.id, { isSource: true, cssClass: element.id + "-no", dragOptions: {}}, {anchor : element.designer.reverse ? "RightMiddle" : "LeftMiddle", uuid : element.id+"-no"});
    noEndpoint.addOverlay(["Label", { cssClass: element.designer.reverse ? "yes-no-label yes-label": "yes-no-label no-label", label: "no", id: 'no' }]);
    var yesEndpoint = instance.addEndpoint(element.id, { isSource: true, cssClass: element.id + "-yes", dragOptions: {}}, {anchor : element.designer.reverse ? "LeftMiddle" : "RightMiddle", uuid : element.id+"-yes"});
    yesEndpoint.addOverlay(["Label", { cssClass: element.designer.reverse ? "yes-no-label no-label" : "yes-no-label yes-label", label: "yes", id: 'yes' }]);
};


BranchHandler.prototype.connectStep = function(instance, window, step) {
    if (step.designer.next) {
        instance.connect({
            uuids: [step.id + "-no"], 
            target: $('#' + step.designer.next),
            anchors: [step.designer.reverse ? "RightMiddle" : "LeftMiddle", "TopCenter"]
        });
        
    }
    if (step.targetStepId) {
        instance.connect({
            uuids: [step.id + "-yes"], 
            target: $('#' + step.targetStepId),
            anchors: [step.designer.reverse ? "LeftMiddle" : "RightMiddle", "TopCenter"]
        });        
    }

};

BranchHandler.prototype.makeConnection = function(srcElement, connectionInfo) {
    var yesOverlay = connectionInfo.sourceEndpoint.getOverlay('yes');
    if (yesOverlay) {
        srcElement.targetStepId = connectionInfo.targetId;
    }
    else {
        srcElement.designer.next = connectionInfo.targetId;
    }
};

BranchHandler.prototype.detachConnection = function(srcElement, connectionInfo) {
    var yesOverlay = connectionInfo.sourceEndpoint.getOverlay('yes');
    if (yesOverlay) {
        srcElement.targetStepId = undefined;
    }
    else {
        srcElement.designer.next = undefined;
    }
};

BranchHandler.prototype.getTemplate = function() {
    return "/resources/templates/branchForm.html";
};

BranchHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#FFFF00');
    $window.data('mgShape','diamond')
};

BranchHandler.prototype.canSwitchSides = function() {
    return true;
};


/************************************************************************************************************************************/

/************************************************************************************************************************************/

function YesNoPrompthHandler() {

}

YesNoPrompthHandler.prototype = new BranchHandler();

YesNoPrompthHandler.prototype.constructor = BranchHandler;

YesNoPrompthHandler.prototype.getTemplate = function() {
    return "/resources/templates/yesnopromptForm.html";
};

YesNoPrompthHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "yesnoprompt",
        "dataType":"boolean",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top
        }
    };
};

YesNoPrompthHandler.prototype.getClass = function() {
    return "YesNoElement";
};

YesNoPrompthHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }
    return step.text;
};

YesNoPrompthHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#62f74c');
    $window.data('mgShape','diamond')
};

/************************************************************************************************************************************/

function StatementHandler() {
    PromptHandler.call(this);
}

StatementHandler.prototype = new PromptHandler();

StatementHandler.prototype.constructor = PromptHandler;

StatementHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "statement",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top   
        },
        "text": ""
    };
};

StatementHandler.prototype.getClass = function() {
    return "StatementElement";
};

StatementHandler.prototype.getTemplate = function() {
    return "/resources/templates/statementForm.html";
};

StatementHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#a1dbff');
};

/************************************************************************************************************************************/
function WithErrorHandler() {

}

WithErrorHandler.prototype = new StatementHandler();
WithErrorHandler.prototype.constructor = StatementHandler;

WithErrorHandler.prototype.addEndpoints = function(instance, element) {
    instance.addEndpoint(element.id, {
        maxConnections: -1,
        dropOptions: { hoverClass: "hover", activeClass: "active" },
        isTarget: true,
        cssClass: element.id + "-top"
    }, { anchor: "TopCenter" });

    var successEndPoint = instance.addEndpoint(element.id, { isSource: true, cssClass: element.id + "-bottom", dragOptions: {} }, { anchor: "BottomCenter" });
    var failEndPoint = instance.addEndpoint(element.id, { isSource: true, cssClass: element.id + "-fail", dragOptions: {}, paintStyle: {strokeStyle:"red"} }, { anchor: element.designer.reverse ? "RightMiddle" : "LeftMiddle", uuid: element.id + "-fail" });        

    $(successEndPoint.canvas).attr('title', "success");
    $(successEndPoint.canvas).tooltip({ container: 'body', placement: 'bottom' });

    $(failEndPoint.canvas).attr('title', "fail");
    $(failEndPoint.canvas).tooltip({ container: 'body', placement: 'bottom' });
};

WithErrorHandler.prototype.connectStep = function(instance, window, step) {
    instance.connect({
        source: window, 
        target: $('#' + step.designer.next),
        anchors: ["BottomCenter", "TopCenter"]
    });

    if (step.designer.errorStepId) {
        instance.connect({
            uuids: [step.id + "-fail"], 
            target: $('#' + step.designer.errorStepId),
            anchors: [step.designer.reverse ? "RightMiddle" : "LeftMiddle", "TopCenter"]
        });        
    }
};

WithErrorHandler.prototype.makeConnection = function(srcElement, connectionInfo) {
    var fail = (connectionInfo.sourceEndpoint.getPaintStyle().strokeStyle == "red")
    if (fail) {
        srcElement.designer.errorStepId = connectionInfo.targetId;
    }
    else {
        srcElement.designer.next = connectionInfo.targetId;
    }
};

WithErrorHandler.prototype.detachConnection = function(srcElement, connectionInfo) {
    var fail = (connectionInfo.sourceEndpoint.getPaintStyle().strokeStyle == "red")
    if (fail) {
        srcElement.designer.errorStepId = undefined;
    }
    else {
        srcElement.designer.next = undefined;
    }
};

WithErrorHandler.prototype.canSwitchSides = function() {
    return true;
};


/************************************************************************************************************************************/
function BeginScenarioHandler() {
    
}

BeginScenarioHandler.prototype = new StatementHandler();

BeginScenarioHandler.prototype.constructor = StatementHandler;

BeginScenarioHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "beginScenario",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top   
        },
        "scenario": ""
    };
};

BeginScenarioHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }
    return step.scenario;
};


BeginScenarioHandler.prototype.getClass = function() {
    return "BeginScenarioElement";
};

BeginScenarioHandler.prototype.getTemplate = function() {
    return "/resources/templates/beginScenarioForm.html";
};

BeginScenarioHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#d3befe');
    $window.data('mgShape','circle')
};

BeginScenarioHandler.prototype.getCaption = function() {
    return "Begin Scenario"
}
/************************************************************************************************************************************/
function ReplaceScenarioHandler() {
    
}

ReplaceScenarioHandler.prototype = new BeginScenarioHandler();

ReplaceScenarioHandler.prototype.constructor = BeginScenarioHandler;

ReplaceScenarioHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "replaceScenario",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top   
        },
        "scenario": ""
    };
};

ReplaceScenarioHandler.prototype.addEndpoints = function(instance, element) {
    instance.addEndpoint(element.id, {
        maxConnections: -1,
        dropOptions: { hoverClass: "hover", activeClass: "active" },
        isTarget: true,
        cssClass: element.id + "-top",
    }, { anchor: "TopCenter" });
};

ReplaceScenarioHandler.prototype.connectStep = function(instance, window, step) {
    instance.connect({
        source: window, 
        target: $('#' + step.designer.next),
        anchors: ["BottomCenter"]
    });
};

ReplaceScenarioHandler.prototype.getCaption = function() {
    return "Replace Scenario"
};

    /************************************************************************************************************************************/
    function ActionHandler() {
        StatementHandler.call(this);
    }

    ActionHandler.prototype = new StatementHandler('action');

    ActionHandler.prototype.constructor = StatementHandler;

    ActionHandler.prototype.text = function(step) {
        var defaultText = "";
        if (defaultText = this.getDefaultText((step)))
        {
            return defaultText;
        }
        return step.onInit;
    };

    ActionHandler.prototype.getTemplate = function() {
        return "/resources/templates/actionForm.html";
    };

    ActionHandler.prototype.getElementFormCtrl = function() {
        return ActionElementFormCtrl;
    }

    ActionHandler.prototype.getClass = function() {
        return "ActionElement";
    };

    ActionHandler.prototype.getNewElement = function (id, position) {
        return  {
            "id": id,
            "type": "action",
            "label": "Action",
            "designer": {
                "xLocation": position.left,
                "yLocation": position.top
            },
            "onInit": "/*\n" + [
                " * Use the following variable notation:",
                " * ",
                " * scenario.var = scenario local variables",
                " * user.var = user data variables",
                " * conversation.var = global conversation variables",
                " * ",
                " * Available object to use in the code:",
                " * require, session, moment, builder, underscore",
                " * ",
                " * Hit 'Ctrl + Space' for autocomplete",
                " * ",
                " * Example: scenario.welcomeMessage = \"Hello \" + scenario.name"
            ].join('\n') + "\n*/"

        };
    };

    ActionHandler.prototype.addCustomData = function($window) {
        $window.data('mgColor', '#ededed');
        $window.data('mgShape','square')
    };

    /************************************************************************************************************************************/
    function WaitHandler() {
        StatementHandler.call(this);
    }

    WaitHandler.prototype = new StatementHandler('wait');

    WaitHandler.prototype.constructor = StatementHandler;

    WaitHandler.prototype.text = function(step) {
        var defaultText = "";
        if (defaultText = this.getDefaultText((step)))
        {
            return defaultText;
        }
        return step.onInit;
    };

    WaitHandler.prototype.getTemplate = function() {
        return "/resources/templates/waitForm.html";
    };

    WaitHandler.prototype.getElementFormCtrl = function() {
        return WaitElementFormCtrl;
    };

    WaitHandler.prototype.getClass = function() {
        return "WaitElement";
    };

    WaitHandler.prototype.getNewElement = function (id, position) {
        return  {
            "id": id,
            "label": "Wait",
            "type": "wait",
            "designer": {
                "xLocation": position.left,
                "yLocation": position.top
            },
            "time": "1000"
        };
    };

    WaitHandler.prototype.addCustomData = function($window) {
        $window.data('mgColor', '#ededed');
        $window.data('mgShape','square')
    };


/************************************************************************************************************************************/
function LUISHandler() {
    StatementHandler.call(this);
}

LUISHandler.prototype = new WithErrorHandler();

LUISHandler.prototype.constructor = WithErrorHandler;

LUISHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }
    return step.utterance + " --> " + step.variable;
};

LUISHandler.prototype.getTemplate = function() {
    return "/resources/templates/luisForm.html";
};

LUISHandler.prototype.getElementFormCtrl = function() {
   return LUISElementFormCtrl;
};

LUISHandler.prototype.getClass = function() {
    return "luiselement";
};

LUISHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "luis",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top   
        },
    };
};

LUISHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor', '#499bea');
    $window.data('mgShape','square')
};
/************************************************************************************************************************************/
function InvokeSkillHandler() {
    StatementHandler.call(this);
}

InvokeSkillHandler.prototype = new StatementHandler();

InvokeSkillHandler.prototype.constructor = StatementHandler;

InvokeSkillHandler.prototype.text = function(step) {
    return step.label || "Invoke Skill"
};

InvokeSkillHandler.prototype.getTemplate = function() {
    return "/resources/templates/invokeSkillForm.html";
};

InvokeSkillHandler.prototype.getElementFormCtrl = function() {
    return InvokeSkillElementFormCtrl;
};

InvokeSkillHandler.prototype.getClass = function() {
    return "InvokeSkillElement";
};

InvokeSkillHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "invokeSkill",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top
         },
    };
};

InvokeSkillHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor', '#499bea');
     $window.data('mgShape','square')
};

/************************************************************************************************************************************/
function EndWithResultHandler() {
    StatementHandler.call(this);    
}

EndWithResultHandler.prototype = new StatementHandler();

EndWithResultHandler.prototype.constructor = StatementHandler;

EndWithResultHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }
    return step.returnValue;
};

EndWithResultHandler.prototype.addEndpoints = function(instance, element) {
    instance.addEndpoint(element.id, {
        maxConnections: -1,
        dropOptions: { hoverClass: "hover", activeClass: "active" },
        isTarget: true,
        cssClass: element.id + "-top",
    }, { anchor: "TopCenter" });
};

EndWithResultHandler.prototype.getTemplate = function() {
    return "/resources/templates/endWithResultForm.html";
};

EndWithResultHandler.prototype.getElementFormCtrl = function() {
   return EndWithResultElementFormCtrl;
};

EndWithResultHandler.prototype.getClass = function() {
    return "EndWithResultElement";
};

EndWithResultHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "endwithresult",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top   
        },
        "endScope":"scenario"
    };
};

EndWithResultHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor', '#499bea');
    $window.data('mgShape','square')
};

/************************************************************************************************************************************/
function DatasourceHandler() {
    StatementHandler.call(this);
}

DatasourceHandler.prototype = new WithErrorHandler();

DatasourceHandler.prototype.constructor = WithErrorHandler;

DatasourceHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "datasource",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top
        }
    }
};

DatasourceHandler.prototype.text = function(step) {
    return step.label || " Data Connection step";
};

DatasourceHandler.prototype.getClass = function() {
    return "DatasourceElement";
};

DatasourceHandler.prototype.getTemplate = function() {
    return "/resources/templates/datasourceForm.html";
};

DatasourceHandler.prototype.getElementFormCtrl = function() {
    return DatasourceElementFormCtrl;
};

DatasourceHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#f07f75');
    $window.data('mgShape','ellipse')
};


/************************************************************************************************************************************/
function GlobalContextHandler() {
    StatementHandler.call(this);
}

GlobalContextHandler.prototype = new WithErrorHandler();

GlobalContextHandler.prototype.constructor = WithErrorHandler;

GlobalContextHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "globalContext",
        "operation":"Get",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top
        },
    };
};

GlobalContextHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }

    if(!step.contextName)
    {
        return step.operation;
    }

    return step.operation + ': ' + step.contextName;
};

GlobalContextHandler.prototype.getClass = function() {
    return "GlobalContextElement";
};

GlobalContextHandler.prototype.getTemplate = function() {
    return "/resources/templates/globalContextForm.html";
};

GlobalContextHandler.prototype.getElementFormCtrl = function() {
    return GlobalContextElementFormCtrl;
};

GlobalContextHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#f07f75');
    $window.data('mgShape','circle')
};

/************************************************************************************************************************************/
function SwitchHandler() {}

SwitchHandler.prototype = new BaseHandler();

SwitchHandler.prototype.constructor = BaseHandler;

SwitchHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "switch",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top   
        },
        "cases" :[{value:'', targetStepId:''}]
    };
};

SwitchHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }
    if (step.condition) {
        var t = step.condition + " --> ";
        step.cases.forEach(function(c, i, a){
            t+=c.value;
            if (i < a.length - 1) {
                t+=",";
            }
        });
        return t;
    }
    return "";
};

SwitchHandler.prototype.getClass = function() {
    return "SwitchElement";
};

SwitchHandler.prototype.addEndpoints = function(instance, element) {
    instance.addEndpoint(element.id, {
        maxConnections: -1,
        dropOptions: { hoverClass: "hover", activeClass: "active" },
        isTarget: true,
        cssClass: element.id + "-top",
    }, { anchor: "TopCenter" });

    // Add default endpoint
    var defaultEndpoint = instance.addEndpoint(element.id, {
        isSource: true,
        anchor: [ 0.8, 0.45, 0, 0, -10, 0 ],
        cssClass: element.id + "-default",
        uuid: element.id + "-default"
    });
    $(defaultEndpoint.canvas).attr('title', "default");
    $(defaultEndpoint.canvas).tooltip({ container: 'body', placement: 'bottom' });

    // Loop on all other cases
    var leftOffset =  0.1 + (1 - 0.15 * element.cases.length) / 2;
    angular.forEach(element.cases, function(ca, index) {
        var dynamicAnchors = [ [ leftOffset + index * 0.15, 0.92, 0, -1, 0, 5 ]];

        var endpoint = instance.addEndpoint(element.id, {
                        isSource: true,
                        anchor: dynamicAnchors,
                        cssClass: element.id + "-switch-" + index,
                        uuid: element.id + "-" + ca.value
                        });
        $(endpoint.canvas).attr('title', ca.value);
        $(endpoint.canvas).tooltip({ container: 'body', placement: 'bottom' });
    });
};

SwitchHandler.prototype.getTemplate = function() {
    return "/resources/templates/switchForm.html";
};

SwitchHandler.prototype.getElementFormCtrl = function () {
    return SwitchElementFormCtrl;
};

SwitchHandler.prototype.makeConnection = function(srcElement, connectionInfo) {
    var uuid = connectionInfo.sourceEndpoint.getUuid();
    if (uuid == srcElement.id + "-default") {
        srcElement.designer.next = connectionInfo.targetId;
        connectionInfo.connection.addOverlay(['Label',{label:'default', cssClass:'yes-no-label'}])        
    }
    angular.forEach(srcElement.cases, function(ca, index) {
        if (srcElement.id + '-' + ca.value  == uuid) {
            srcElement.cases[index].targetStepId = connectionInfo.targetId;
            connectionInfo.connection.addOverlay(['Label',{label:ca.value, cssClass:'yes-no-label'}])
        }
    });
};


SwitchHandler.prototype.detachConnection = function(srcElement, connectionInfo) {
    var uuid = connectionInfo.sourceEndpoint.getUuid();
    if (uuid == srcElement.id + "-default") {
        srcElement.designer.next = undefined;
    }
    angular.forEach(srcElement.cases, function(ca, index) {
        if (srcElement.id + '-' + ca.value  == uuid) {
            srcElement.cases[index].targetStepId = undefined; 
        }
    });
};

SwitchHandler.prototype.connectStep = function(instance, window, step) {
    if (step.designer.next) {
        instance.connect({
            uuids: [step.id + "-default"], 
            target: $('#' + step.designer.next),
            anchors: ["BottomCenter", "TopCenter"]
        });        
    }
    angular.forEach(step.cases, function(ca, index) {
        var connection = instance.connect({
            uuids: [step.id + "-" + ca.value], 
            target: $('#' + ca.targetStepId),
            anchors: ["BottomCenter", "TopCenter"]
        })
        if (connection) {
            connection.addOverlay(['Label',{label:ca.value, cssClass:'yes-no-label'}])
        }
    })
};

SwitchHandler.prototype.postEditOK = function (instance, oldStep, newStep) {
    var _this = this;
    var $window = $('#' + newStep.id); 
    var tempElement =  angular.copy(newStep);
    // Remove all cases end points
    instance.deleteEndpoint(tempElement.id + "-default");
    if (oldStep.cases.length > 0) {
        angular.forEach(oldStep.cases, function(ca, index) {
            instance.deleteEndpoint(tempElement.id + "-" + ca.value);
            // When done, add and reconnect all endpoints
            if ((index + 1) == oldStep.cases.length || oldStep.cases.length == 0) {
                _this.addEndpoints(instance, tempElement);
                _this.connectStep(instance, $window, tempElement);
            }       
        });
    } else {
        _this.addEndpoints(instance, tempElement);
        _this.connectStep(instance, $window, tempElement);        
    }
};

SwitchHandler.prototype.postEditCancel = function(instance, tempElement) {

};

SwitchHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor','#FF69B4');
    $window.data('mgShape','triangle');
};
