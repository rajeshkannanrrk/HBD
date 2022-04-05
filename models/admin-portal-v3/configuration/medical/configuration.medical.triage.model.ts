import {getValueByPath} from "../../configuration/configuration.common.model";
import {ConfigurationPageModel} from "../../configuration/configuration.page.model";

const name = "Medical > Triage";
const contentProviders = ["infermedica", "capita"];
const mapping = {

    triage_provider: "medical_content.triage_provider",
    infermedica: {
        multilingual: {
            enable: "infermedica.multilingual.enable"
        },
        general: {
            interruptible: "conversation./builtin/infermedica/triage.interruptible",
            returning_message: "conversation./builtin/infermedica/triage.returning_message",
            ignore_concepts: "infermedica.ignore_concepts",
            something_went_wrong_triage_text: "infermedica.conversation.something_went_wrong_triage_text",
            enable_feedback: "infermedica.feedback.enabled"
        },
        suggest: {
            propose_suggest_symptoms: "infermedica.suggest.propose_suggest_symptoms",
            suggest_prompt_text: "infermedica.suggest.suggest_prompt_text",
            suggest_prompt_text_third_person: "infermedica.suggest.suggest_prompt_text_third_person"
        },
        red_flags: {
            propose_red_flag_symptoms: "infermedica.red_flags.propose_red_flag_symptoms",
            red_flags_prompt_text: "infermedica.red_flags.red_flags_prompt_text",
            red_flags_prompt_text_third_person: "infermedica.red_flags.red_flags_prompt_text_third_person"
        },
        preassessment: {
            echo_registered_symptoms: "infermedica.preassessment.echo_registered_symptoms",
            echo_registered_symptoms_text_additional: "infermedica.preassessment.echo_registered_symptoms_text_additional",
            echo_registered_symptoms_text_no_symptoms_added: "infermedica.preassessment.echo_registered_symptoms_text_no_symptoms_added",
            echo_registered_symptoms_text_initial: "infermedica.preassessment.echo_registered_symptoms_text_initial",
            verify_extracted_symptoms: "infermedica.preassessment.verify_extracted_symptoms",
            verify_extracted_symptoms_list_text: "infermedica.preassessment.verify_extracted_symptoms_list_text",
            verify_extracted_symptoms_confirmation_text: "infermedica.preassessment.verify_extracted_symptoms_confirmation_text",
            unconfirmed_extracted_symptoms_initial_message: "infermedica.preassessment.unconfirmed_extracted_symptoms_initial_message",
            minimum_recommended_positive_symptoms: "infermedica.preassessment.minimum_recommended_positive_symptoms",
            report_additional_symptoms_strong_prompt: "infermedica.preassessment.report_additional_symptoms_strong_prompt",
            report_additional_symptoms_weak_prompt: "infermedica.preassessment.report_additional_symptoms_weak_prompt",
            display_final_prompt_for_additional_symptoms: "infermedica.preassessment.display_final_prompt_for_additional_symptoms",
            report_additional_symptoms_yes_no_prompt: "infermedica.preassessment.report_additional_symptoms_yes_no_prompt",
            report_additional_symptoms_what_prompt: "infermedica.preassessment.report_additional_symptoms_what_prompt",
            nothing_else_to_report_regexp: "infermedica.preassessment.nothing_else_to_report_regexp",
            begin_assessment_message: "infermedica.preassessment.begin_assessment_message",
            display_begin_assessment_message: "infermedica.preassessment.display_begin_assessment_message",
            rephrase_symptoms_prompt: "infermedica.preassessment.rephrase_symptoms_prompt",
            rephrase_symptoms_or_skip_prompt: "infermedica.preassessment.rephrase_symptoms_or_skip_prompt",
            need_more_information: "infermedica.preassessment.need_more_information",
            begin_additional_information_message: "infermedica.preassessment.begin_additional_information_message",
            display_begin_additional_information_message: "infermedica.preassessment.display_begin_additional_information_message"
        },
        gender: {
            gender_prompt_text: {
                second_person: "infermedica.conversation.gender_prompt_text.second_person",
                third_person: "infermedica.conversation.gender_prompt_text.third_person"
            },
            gender_prompt_choice: {
                male: "infermedica.conversation.gender_prompt_choice.male",
                female: "infermedica.conversation.gender_prompt_choice.female",
            },
            gender_reprompt_text: {
                second_person: "infermedica.conversation.gender_reprompt_text.second_person",
                third_person: "infermedica.conversation.gender_reprompt_text.third_person"
            }
        },
        age: {
            age_prompt_text: {
                male: {
                    second_person: "infermedica.conversation.age_prompt_text.male.second_person",
                    third_person: "infermedica.conversation.age_prompt_text.male.third_person"
                },
                female: {
                    second_person: "infermedica.conversation.age_prompt_text.female.second_person",
                    third_person: "infermedica.conversation.age_prompt_text.female.third_person"
                }
            },
            invalid_age_prompt_text: "infermedica.conversation.invalid_age_prompt_text",
            minimum_age_self_use_text: "infermedica.conversation.minimum_age_self_use_text",
            age_approval_text: "infermedica.conversation.age_approval_text",
            age_reenter_text: {
                male: {
                    second_person: "infermedica.conversation.age_reenter_text.male.second_person",
                    third_person: "infermedica.conversation.age_reenter_text.male.third_person"
                },
                female: {
                    second_person: "infermedica.conversation.age_reenter_text.female.second_person",
                    third_person: "infermedica.conversation.age_reenter_text.female.third_person"
                }
            }
        },
        pregnancy: {
            ask_for_pregnancy_status: "infermedica.conversation.pregnancy_status.ask_for_pregnancy_status",
            minimum_age_to_ask_about_pregnancy: "infermedica.conversation.pregnancy_status.minimum_age_to_ask_about_pregnancy",
            maximum_age_to_ask_about_pregnancy: "infermedica.conversation.pregnancy_status.maximum_age_to_ask_about_pregnancy"
        },
        interview: {
            interview_mode: "infermedica.conversation.interview_mode",
            disable_groups: "infermedica.conversation.disable_groups"
        },
        triage_results: {
            symptom_summary: {
                show_summary: "infermedica.symptom_summary.show_summary",
                title_text: "infermedica.symptom_summary.title_text",
                initial_complaint_singular_text: "infermedica.symptom_summary.initial_complaint_singular_text",
                initial_complaint_plural_text: "infermedica.symptom_summary.initial_complaint_plural_text",
                additional_present_concepts_text: "infermedica.symptom_summary.additional_present_concepts_text",
                user_details: "infermedica.symptom_summary.user_details"
            },
            causes: {
                show_causes: "infermedica.causes.show_causes",
                title_text: "infermedica.causes.title_text",
                no_causes_found_text: "infermedica.causes.no_causes_found_text",
                display_cause_frequency_rating: "infermedica.causes.display_cause_frequency_rating",
                maximal_cause_count: "infermedica.causes.maximal_cause_count"
            },
            show_triage: "infermedica.triage.show_triage",
            title_text: "infermedica.triage.title_text",
            categories: "infermedica.triage.categories",
        }
    },
    capita: {
        general: {
            returning_message: "conversation./builtin/capita/triage.returning_message",
            something_went_wrong_triage_text: "capita.conversation.something_went_wrong_triage_text",
            enable_feedback: "capita.feedback.enabled"
        },
        gender: {
            gender_prompt_text: {
                second_person: "capita.conversation.gender_prompt_text.second_person",
                third_person: "capita.conversation.gender_prompt_text.third_person"
            },
            gender_prompt_choice: {
                male: "capita.conversation.gender_prompt_choice.male",
                female: "capita.conversation.gender_prompt_choice.female",
            },
            gender_reprompt_text: {
                second_person: "capita.conversation.gender_reprompt_text.second_person",
                third_person: "capita.conversation.gender_reprompt_text.third_person"
            }
        },
        age: {
            age_prompt_text: {
                male: {
                    second_person: "capita.conversation.age_prompt_text.male.second_person",
                    third_person: "capita.conversation.age_prompt_text.male.third_person"
                },
                female: {
                    second_person: "capita.conversation.age_prompt_text.female.second_person",
                    third_person: "capita.conversation.age_prompt_text.female.third_person"
                }
            },
            invalid_age_prompt_text: "capita.conversation.invalid_age_prompt_text",
            minimum_age_self_use_text: "capita.conversation.minimum_age_self_use_text",
            age_approval_text: "capita.conversation.age_approval_text",
            age_reenter_text: {
                male: {
                    second_person: "capita.conversation.age_reenter_text.male.second_person",
                    third_person: "capita.conversation.age_reenter_text.male.third_person"
                },
                female: {
                    second_person: "capita.conversation.age_reenter_text.female.second_person",
                    third_person: "capita.conversation.age_reenter_text.female.third_person"
                }
            }
        },
        preassessment: {
            choose_most_important_algorithm: "capita.preassessment.choose_most_important_algorithm",
            re_prompt_choose_most_important_algorithm: "capita.preassessment.re_prompt_choose_most_important_algorithm",
            none_of_the_above_chosen_algorithm: "capita.preassessment.none_of_the_above_chosen_algorithm",
            rephrase_complain_or_quit_prompt: "capita.preassessment.rephrase_complain_or_quit_prompt",
            zero_filtered_algorithms: "capita.preassessment.zero_filtered_algorithms"
        },
        conversation: {
            show_rationale: "capita.conversation.show_rationale"
        },
        triage_results: {
            symptom_summary: {
                show_summary: "capita.symptom_summary.show_summary",
                care_instructions_text: "capita.symptom_summary.care_instructions_text",
                title_text: "capita.symptom_summary.title_text",
                initial_complaint_text: "capita.symptom_summary.initial_complaint_text",
                initial_complaints_text: "capita.symptom_summary.initial_complaints_text",
                protocol_title_text: "capita.symptom_summary.protocol_title_text",
                selected_protocol_title_text: "capita.symptom_summary.selected_protocol_title_text",
                questions_answered_yes_text: "capita.symptom_summary.questions_answered_yes_text",
                questions_answered_no_text: "capita.symptom_summary.questions_answered_no_text",
                user_details: "capita.symptom_summary.user_details",
            },
            show_triage: "capita.triage.show_triage",
            suggested_care_mode: "capita.triage.suggested_care_mode",
            show_disposition_title: "capita.triage.show_disposition_title",
            show_main_suggested_care: "capita.triage.show_main_suggested_care",
            show_additional_suggested_care: "capita.triage.show_additional_suggested_care",
            show_patient_worsening_fast: "capita.triage.show_patient_worsening_fast",
            disposition: "capita.triage.dispositions"
        }
    }
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    for (const provider of contentProviders){
        assert(isValidRegExp(getValueByPath(updatedDate, `${provider}.tell_us_more.negative_reply_regexp`)), `Tell us more > Negative reply regexp invalid`);
        assert(isValidRegExp(getValueByPath(updatedDate, `${provider}.tell_us_more.positive_reply_regexp`)), `Tell us more > Positive reply regexp invalid`);
        assert(isValidRegExp(getValueByPath(updatedDate, `${provider}.tell_us_more.all_reply_regexp`)), `Tell us more > All reply regexp invalid`);

        let pregMin = getValueByPath(updatedDate, `${provider}.pregnancy.minimum_age_to_ask_about_pregnancy`);
        let pregMax = getValueByPath(updatedDate, `${provider}.pregnancy.maximum_age_to_ask_about_pregnancy`);

        pregMin = (pregMin !== undefined) ? pregMin : 12;
        pregMax = (pregMax !== undefined) ? pregMax : 60;

        if (pregMin > pregMax || pregMax < 0 || pregMin > 120) {
            assert(false, "Pregnancy age limitation invalid");
        }
    }
    const recommendedSymptomsCount = getValueByPath(updatedDate, `infermedica.preassessment.minimum_recommended_positive_symptoms`);
    if (recommendedSymptomsCount !== undefined){
        assert(recommendedSymptomsCount > 0, "Recommended count of symptoms to collect has to be a positive number");
    }
    assert(isValidRegExp(getValueByPath(updatedDate, `infermedica.preassessment.nothing_else_to_report_regexp`)), `Preassessment > Nothing else to report regexp invalid`);
    return;
}

function isValidRegExp(val) {
    try {
        if (val !== undefined && val !== null) {
            let regExp = null;
            const regexpMatch = val.match(/^\/(.*?)\/([gimy]*)$/);
            if (regexpMatch) {
                regExp = new RegExp(regexpMatch[1], regexpMatch[2]);
            }
            return regExp !== null && regExp !== undefined;
        }
        return true;

    } catch (e) {
        return false;
    }
}

export const ConfigurationMedicalTriage = new ConfigurationPageModel(name, mapping, customValidator);
