import * as mainModel from "../../../models/admin-portal-v3/main.model";
import {router as medicalInformationController} from "./medical/configuration.medical.medical-information.ctrl";
import {router as triageController} from "./medical/configuration.medical.triage.ctrl";
const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("medical");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data: any  = await mainModel.getData(req);
        res.render('admin-portal-v3/configuration/configuration.medical.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.use('/information', medicalInformationController);
router.use('/triage', triageController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
