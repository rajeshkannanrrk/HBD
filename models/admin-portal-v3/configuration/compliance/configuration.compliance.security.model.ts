import { ConfigurationPageModel } from "../../configuration/configuration.page.model";

const name = "Compliance > Security";
const mapping = {
    conversation_timeout_duration_in_minutes : "security.conversation_timeout_duration_in_minutes",
    conversation_timeout_message: "security.conversation_timeout_message",
    user_authentication_required: "security.user_authentication_required"
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    // TODO: add custom validator if needed
    return;
}

export const ConfigurationComplianceSecurity = new ConfigurationPageModel(name, mapping, customValidator);
