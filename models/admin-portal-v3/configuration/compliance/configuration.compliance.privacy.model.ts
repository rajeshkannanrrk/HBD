import { ConfigurationPageModel } from "../../configuration/configuration.page.model";

const name = "Compliance > Privacy";
const mapping = {
    privacy_queries: {
        reply: "conversation./builtin/need_to_know.reply",
        interrupting: "conversation./builtin/need_to_know.interrupting",
        breaking: "conversation./builtin/need_to_know.breaking"
    },
    view_personal_data: {
        intro: "conversation./builtin/user_info.intro",
        no_info: "conversation./builtin/user_info.no_info",
        interrupting: "conversation./builtin/user_info.interrupting",
        breaking: "conversation./builtin/user_info.breaking"
    },
    delete_all_data: {
        warning: "conversation./builtin/forget_me.warning",
        confirmation: "conversation./builtin/forget_me.confirmation",
        abort_confirmation: "conversation./builtin/forget_me.abort_confirmation",
        interruptible: "conversation./builtin/forget_me.interruptible",
        returning_message: "conversation./builtin/forget_me.returning_message",
        interrupting: "conversation./builtin/forget_me.interrupting"
    },
    data_retention: {
        trails_delete_policy: "conversation./builtin/forget_me.trails_delete_policy",
        save_conversation_trails: "system_capability_flags.save_conversation_trails",
        enable_feedback: "system_capability_flags.enable_feedback"
    },
    view_conversation_history: {
        title: "conversation./builtin/log.title",
        foot_note: "conversation./builtin/log.foot_note",
        more: "conversation./builtin/log.more",
        log: {
            interrupting: "conversation./builtin/log.interrupting",
            breaking: "conversation./builtin/log.breaking"
        },
        log_before: {
            interrupting: "conversation./builtin/log_before.interrupting",
            breaking: "conversation./builtin/log_before.breaking"
        }
    }
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    // TODO: add custom validator if needed
    return;
}

export const ConfigurationCompliancePrivacy = new ConfigurationPageModel(name, mapping, customValidator);
