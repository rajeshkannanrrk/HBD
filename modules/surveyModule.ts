export const TENANT_SATISFACTION_SURVEY_ID = "tenant_satisfaction";

export interface Survey {
	askedCount: number;
	status: SurveyStatus;
};

export enum SurveyStatus {
	Initial = "Initial",
	Answered = "Answered",
	Declined = "Declined",
};

export const InitialSurveyData: Survey = {
	askedCount: 0,
	status: SurveyStatus.Initial
};
