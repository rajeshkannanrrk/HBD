import * as mainModel from "../../models/admin-portal-v3/main.model";
import {router as catalogController} from "./scenarios/scenarios.catalog.ctrl";
import {router as catalogEditorController} from "./scenarios/scenarios.catalogEditor.ctrl";
import {router as manageController} from "./scenarios/scenarios.manage.ctrl";
import {router as searchController} from "./scenarios/scenarios.search.ctrl";
const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("scenarios");
    next();
});

router.use('/catalog', catalogController);
router.use('/catalogEditor', catalogEditorController);
router.use('/manage', manageController);
router.use('/search', searchController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
