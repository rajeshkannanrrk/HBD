import * as mainModel from "../../models/admin-portal-v3/main.model";
import {router as conversationTrailsController} from "./analytics/analytics.conversation-trails.ctrl";
import {router as feedbackController} from "./analytics/analytics.feedback.ctrl";
import {router as reportsController} from "./analytics/analytics.reports.ctrl";
import {router as unrecognizedUtterancesController} from "./analytics/analytics.unrecognized-utterances.ctrl";
const express = require('express');
export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("analytics");
    next();
});

router.use('/feedback', feedbackController);
router.use('/reports', reportsController);
router.use('/unrecognized-utterances', unrecognizedUtterancesController);
router.use('/conversation-logs', conversationTrailsController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
