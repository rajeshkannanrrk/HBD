import * as mainModel from "../../models/admin-portal-v3/main.model";

import {router as complianceController} from "./configuration/configuration.compliance.ctrl";
import {router as conversationController} from "./configuration/configuration.conversation.ctrl";
import {router as medicalController} from "./configuration/configuration.medical.ctrl";
import {router as systemAdminController} from "./configuration/configuration.system-admin.ctrl";
import {router as localizationController} from "./language-models/localization.ctrl";
const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("configuration");
    next();
});

router.use('/compliance', complianceController);
router.use('/conversation', conversationController);
router.use('/medical', medicalController);
router.use('/localization', localizationController);
router.use('/system-admin', systemAdminController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
