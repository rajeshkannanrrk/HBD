import * as mainModel from "../../models/admin-portal-v3/main.model";
import {router as environmentVariablesController} from "./resources/resources.environment-variables.ctrl";
import {router as filesController} from "./resources/resources.files.ctrl";
const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("resources");
    next();
});

router.use('/files', filesController);
router.use('/environment-variables', environmentVariablesController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
