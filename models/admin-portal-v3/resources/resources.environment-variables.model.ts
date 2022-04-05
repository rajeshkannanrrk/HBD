import { ConfigurationPageModel } from "../configuration/configuration.page.model";

const name = "Environment variables";

const mapping = {
    environment_variables: "environment_variables.variables"
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    if (updatedDate.environment_variables) {
        const usedNames = {};
        for (let i = 0; i < updatedDate.environment_variables.length; i++) {
            const variable = updatedDate.environment_variables[i];
            assert(variable.name.trim().length > 0, `Row ${i + 1}: Name is empty`);
            assert(variable.value.trim().length > 0, `Row ${i + 1}: Value is empty`);
            assert(!usedNames[variable.name.trim()], `"${variable.name.trim()}" is defined more than once`);
            usedNames[variable.name.trim()] = true;
        }
    }
}

export const resourcesEnvironmentVariablesModel = new ConfigurationPageModel(name, mapping, customValidator);
