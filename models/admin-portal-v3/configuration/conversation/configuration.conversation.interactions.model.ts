import { ConfigurationPageModel } from "../../configuration/configuration.page.model";
import { tenantContents } from "../../../../modules/globals";

const name = "Conversation > Interactions";
const mapping = {
    general: {
        default_reply: "conversation.default_reply",
        default_returning_message: "conversation.default_returning_message",
        default_error_message: "conversation.default_error_message",
        default_number_retry_prompt: "conversation.default_number_retry_prompt",
        default_confirm_retry_prompt: "conversation.default_confirm_retry_prompt",
        default_choice_retry_prompt: "conversation.default_choice_retry_prompt",
        default_multichoice_retry_prompt: "conversation.default_multichoice_retry_prompt",
        default_time_retry_prompt: "conversation.default_time_retry_prompt",
        default_file_retry_prompt: "conversation.default_file_retry_prompt"

    },
    automatic_welcome: {
        auto_welcome_message: "conversation.auto_welcome_message",
        auto_welcome_scenario: "conversation.auto_welcome_scenario"
    },
    greetings: {
        reply: "conversation./builtin/greeting.reply",
        interrupting: "conversation./builtin/greeting.interrupting",
        breaking: "conversation./builtin/greeting.breaking",
    },
    feedback: {
        enabled: "system_capability_flags.enable_feedback",
        prompt: "conversation./builtin/feedback.prompt",
        confirmation: "conversation./builtin/feedback.confirmation",
        interruptible: "conversation./builtin/feedback.interruptible",
        returning_message: "conversation./builtin/feedback.returning_message",
        interrupting: "conversation./builtin/feedback.interrupting",
        breaking: "conversation./builtin/feedback.breaking"
    }
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    // TODO: add custom validator if needed
    return;
}

async function afterRead(account, scheme) {
    const accountScenarios = await tenantContents[account.name].scenarios.listLightScenarios();
    const triggers = accountScenarios.map((s) => s.scenario_trigger);
    triggers.push('');
    triggers.sort();
    scheme.conversation.auto_welcome_scenario.format = triggers;
}

export const ConfigurationConversationInteractions = new ConfigurationPageModel(name, mapping, customValidator, afterRead);
