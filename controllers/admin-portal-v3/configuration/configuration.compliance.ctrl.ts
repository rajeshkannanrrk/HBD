
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import {router as compliancePrivacyController} from "./compliance/configuration.compliance.privacy.ctrl";
import {router as complianceSecurityController} from "./compliance/configuration.compliance.security.ctrl";
import {router as complianceTermsAndConsentController} from "./compliance/configuration.compliance.terms-and-concent.ctrl";
const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("compliance");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data: any  = await mainModel.getData(req);
        res.render('admin-portal-v3/configuration/configuration.compliance.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.use('/privacy', compliancePrivacyController);
router.use('/security', complianceSecurityController);
router.use('/terms-and-consent', complianceTermsAndConsentController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
