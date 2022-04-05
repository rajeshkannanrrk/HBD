import { ConfigurationPageModel } from "../../configuration/configuration.page.model";

const name = "Compliance > Terms and consent";
const mapping = {
    view_terms: {
        reply: "conversation./builtin/terms.reply",
        interrupting: "conversation./builtin/terms.interrupting",
        breaking: "conversation./builtin/terms.breaking"
    },
    end_user_consent: {
        interruptible: "conversation.user_consent.interruptible",
        returning_message: "conversation.user_consent.returning_message",
        bot_name: "user_consent.bot_name",
        enable_ms: "user_consent.enable_ms",
        enable_tenant: "user_consent.enable_tenant",
        major_version: "user_consent.major_version",
        minor_version: "user_consent.minor_version",
        validity_duration_in_days: "user_consent.validity_duration_in_days",
        intro: "user_consent.intro",
        ms_prompt: "user_consent.ms_prompt",
        tenant_prompt: "user_consent.tenant_prompt",
        conclusion_greet: "user_consent.conclusion_greet",
        conclusion_prompt: "user_consent.conclusion_prompt",
        re_prompt: "user_consent.re_prompt"

    },
    policy_urls: {
        tenant_privacy_link: "user_consent.tenant_privacy_link",
        tenant_terms_link: "user_consent.tenant_terms_link"
    }
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    // TODO: add custom validator if needed
    return;
}

export const ConfigurationComplianceTermsAndConsent = new ConfigurationPageModel(name, mapping, customValidator);
