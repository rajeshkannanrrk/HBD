import { ConfigurationPageModel } from "../../configuration/configuration.page.model";

const name = "Medical > Information";

const mapping = {
    general: {
        interrupting: "conversation./builtin/condition/information.interrupting",
        breaking: "conversation./builtin/condition/information.breaking",
        information_answer_not_found_text: "nih.answers.general_information_not_found_text"
    },
    symptoms: {
        interrupting: "conversation./builtin/condition/symptoms.interrupting",
        breaking: "conversation./builtin/condition/symptoms.breaking",
        symptoms_answer_title_text: "nih.answers.symptoms_title_text",
        symptoms_links_multiple_title_text: "nih.answers.symptoms_links_multiple_title_text",
        symptoms_links_single_title_text: "nih.answers.symptoms_links_single_title_text",
        symptoms_answer_not_found_text: "nih.answers.symptoms_information_not_found_text"
    },
    onlineMedicalResources: {
        interrupting: "conversation./builtin/condition/resources.interrupting",
        breaking: "conversation./builtin/condition/resources.breaking",
        resources_answer_title_text: "nih.answers.resources_title_text",
        resources_answer_not_found_text: "nih.answers.resources_information_not_found_text"
    }
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    // TODO: add custom validator if needed
    return;
}

export const ConfigurationMedicalInformation = new ConfigurationPageModel(name, mapping, customValidator);
