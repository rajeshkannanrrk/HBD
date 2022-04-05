import { ConfigurationPageModel } from "../configuration/configuration.page.model";

const name = "System Admin";

const mapping = {
    beginable_builtin_dialogs: "environment_variables.beginable_builtin_dialogs",
    action_support_rp: "system_capability_flags.action_support_rp",
    action_support_set_timeout: "system_capability_flags.action_support_set_timeout"
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    return true;
}

export const configurationSystemAdminModel = new ConfigurationPageModel(name, mapping, customValidator);
