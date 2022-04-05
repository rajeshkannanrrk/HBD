import * as mainModel from "../../models/admin-portal-v3/main.model";
import {router as authenticationController} from "./integration/integration.authentication.ctrl";
import {router as channelsController} from "./integration/integration.channels.ctrl";
import {router as dataConnectionsController} from "./integration/integration.data-connection.ctrl";
import {router as secretsController} from "./integration/integration.secrets.ctrl";
import {router as skillsController} from "./integration/integration.skills.ctrl";

const express = require('express');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("integration");
    next();
});

router.use('/authentication', authenticationController);
router.use('/data-connections', dataConnectionsController);
router.use('/secrets', secretsController);
router.use('/skills', skillsController);
router.use('/channels', channelsController);

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
