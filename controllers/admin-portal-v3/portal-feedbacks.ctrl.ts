import * as portalFeedbacksModel from "../../models/admin-portal-v3/portal-feedbacks.model";
import * as auth from "../../modules/auth";
import { SurveyStatus } from "../../modules/surveyModule";
const express = require('express');
import { UserRole } from '../../modules/auth';
import * as mainModel from "../../models/admin-portal-v3/main.model";

export const router = express.Router();

router.post('/feedback', async (req, res) => {
    if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }        
    try {
        const tenantId = req.account.id;
        const userMail = req.user.emails[0].value;
        const feedback = req.body;
        const result = await portalFeedbacksModel.sendFeedback(feedback, tenantId, userMail, req.userRole);
        return res.status(200).send(result);  
    }
    catch (error) {
        return mainModel.sendErrToClient(res, error);
    }
});

router.post('/survey', async (req, res) => {
    try {
        const tenantId = req.account.id;
        const email = req.user.emails[0].value;
        const survey = req.body.survey;
        await portalFeedbacksModel.sendSurvey(survey, tenantId, email, req.userRole, req.user.objectId);
        await portalFeedbacksModel.updateUserSurveyData(req.account, req.user.emails[0].value, SurveyStatus.Answered, true);
        return res.status(200).send(true);
    }
    catch (error) {
        return mainModel.sendErrToClient(res, error);
    }
});

router.post('/survey/close', async (req, res) => {
    try {
        const survey = req.body.survey;
        let surveyStatus: SurveyStatus = null;
        if (survey.dontShow) {
            surveyStatus = SurveyStatus.Declined;
        }
        await portalFeedbacksModel.updateUserSurveyData(req.account, req.user.emails[0].value, surveyStatus, true);
        return res.status(200).send(true);
    }
    catch (error) {
        return mainModel.sendErrToClient(res, error);
    }
});

router.post('/surveyId', async (req, res) => {
    try {
        let surveyId = null;
        if (req.userRole !== auth.UserRole.SystemAdmin) {
            surveyId = await portalFeedbacksModel.getUserSurveyIdAsync(req.account, req.user.emails[0].value);
        }
        return res.status(200).send({ surveyId });
    }
    catch (error) {
        return mainModel.sendErrToClient(res, error);
    }
});
