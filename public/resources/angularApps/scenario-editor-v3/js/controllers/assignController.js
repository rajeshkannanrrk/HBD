/********************************************************************************************************************* */
var AssignVariableElementFormCtrl = function($scope, element, windows, $uibModalInstance, $autocomplete) {

    $scope.master = element;
    $scope.element = window.angular.copy(element);

    $scope.variables = $autocomplete.variables(windows);

    $scope.variableScopes = ['scenario','conversation','user'];
    
    $scope.operations = ['set', 'incrementBy', 'multiplyBy', 'push']

    $scope.actionHelp = "Use the following variable notation.\n" +
                        "scenario.var = scenario local variables\n" +
                        "user.var = user data variables\n" +
                        "conversation.var = conversation variables\n\n" +
                        "Available object to use in the code:\n" +
                        "require, session, moment, builder, next(), underscore\n\n" +
                        "Hit 'Ctrl+Space' for autocomplete\n\n" +
                        "Example: scenario.welcomeMessage = \"Hello \" + scenario.name";

    $scope.monacoEditorOptions = {
        language: "javascript",
        lineNumbers: 'off'
    };

    $scope.ok = function () {
        $uibModalInstance.close($scope.element);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

}
