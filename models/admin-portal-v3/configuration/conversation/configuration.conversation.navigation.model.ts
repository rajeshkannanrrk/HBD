import { ConfigurationPageModel } from "../../configuration/configuration.page.model";

const name = "Conversation > Navigation";
const mapping = {
    cancel: {
        cancel_reply: "conversation.cancel_reply"
    },
    start_over: {
        start_over_reply: "conversation.start_over_reply"
    },
    version: {
        interrupting: "conversation./builtin/version.interrupting",
        breaking: "conversation./builtin/version.breaking",
    },
    begin: {
        interrupting: "conversation./builtin/begin.interrupting",
        breaking: "conversation./builtin/begin.breaking",
    },
    help: {
        reply: "conversation./builtin/help.reply",
        menuItems: "conversation./builtin/help.menu_items"
    }
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    // TODO: add custom validator if needed
    return;
}

export const ConfigurationConversationNavigation = new ConfigurationPageModel(name, mapping, customValidator);
