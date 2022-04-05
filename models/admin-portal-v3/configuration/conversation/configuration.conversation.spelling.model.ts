import { ConfigurationPageModel } from "../../configuration/configuration.page.model";

const name = "Conversation > Spelling";
const mapping = {
    speller: {
        enable: "conversation.speller.speller_enable",
        corrected_but_not_supported_reply: "conversation.speller.corrected_but_not_supported_reply",
        correction_rejected_reply: "conversation.speller.correction_rejected_reply",
        assuming_you_mean: "conversation.speller.assuming_you_mean",
        did_you_mean: "conversation.speller.did_you_mean",
        speller_locale: "conversation.speller.speller_locale"
    }
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    // TODO: add custom validator if needed
    return;
}

export const ConfigurationConversationSpelling = new ConfigurationPageModel(name, mapping, customValidator);
