import * as mainModel from "../../models/admin-portal-v3/main.model";
import {router as auditTrailsController} from "./users/users.audit-trails.ctrl";
import {router as manageController} from "./users/users.manage.ctrl";

const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("users");
    next();
});

router.use('/manage', manageController);
router.use('/audit-trails', auditTrailsController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
