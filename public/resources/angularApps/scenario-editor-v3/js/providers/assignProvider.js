/************************************************************************************************************************************/
function AssignVariableHandler() {
    StatementHandler.call(this);
}

AssignVariableHandler.prototype = new StatementHandler();

AssignVariableHandler.prototype.constructor = StatementHandler;

AssignVariableHandler.prototype.getNewElement = function (id, position) {
    return  {
        "id": id,
        "type": "assignVariable",
        "designer": {
            "xLocation": position.left,
            "yLocation": position.top
        },
        "scope":"scenario",
        "operation":"set"        
    };
};

AssignVariableHandler.prototype.text = function(step) {
    var defaultText = "";
    if (defaultText = this.getDefaultText((step)))
    {
        return defaultText;
    }
    var op = ""
    switch (step.operation) {
        case "set": 
        op = step.variable + " = " + step.value;
        break;
        case "incrementBy":
        op = step.variable + " += " + step.value;
        break;
        case "multiplyBy":
        op = step.variable + " *= " + step.value;
        break;
        case "push":
        op = step.variable + ".push(" + step.value + ")";
        break;
    }
    return op;
};

AssignVariableHandler.prototype.getClass = function() {
    return "AssignVariableElement";
};

AssignVariableHandler.prototype.getElementFormCtrl = function() {
    return AssignVariableElementFormCtrl;
}

AssignVariableHandler.prototype.getTemplate = function() {
    return "/resources/templates/assignVariableForm.html";
};

AssignVariableHandler.prototype.addCustomData = function($window) {
    $window.data('mgColor', '#ededed');
    $window.data('mgShape','square')
};

