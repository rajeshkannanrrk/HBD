import * as mainModel from "../../models/admin-portal-v3/main.model";

import {router as manageController} from "./language-models/language-models.manage.ctrl";
import {router as localizationController} from "./language-models/localization.ctrl";

const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("language-models");
    next();
});

router.use('/manage', manageController);
router.use('/localization', localizationController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
