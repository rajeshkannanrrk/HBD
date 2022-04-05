import { Router } from "express";
import { errorHandlers, requireRole } from "../../../middlewares/auth";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole } from "../../../modules/auth";
import { tenantContents } from "../../../modules/globals";
import {Logger} from "healthbotcommon/logger";

const logger = Logger.getInstance();

export const router = Router();

const accessDeniedErrorMessage = "You can't access this page";

router.use((req, _, next) => {
    req._navigation_path.push("feedback");
    next();
});

router.get('/', requireRole(UserRole.Reader, errorHandlers.renderErrorPage(accessDeniedErrorMessage)), async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/analytics/analytics.feedback.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.post('/all', requireRole(UserRole.Admin, errorHandlers.renderErrorPage(accessDeniedErrorMessage)), async (req, res) => {
    try {
        const accountName = req.account.name;

        if (!await isFeedbackEnabled(accountName)) {
            return res.status(200).json([]);
        }

        const data = req.body.ids ?
            await Promise.all(req.body.ids.map(async (id) => tenantContents[accountName].feedbacks.retrieve(id.toString()))) :
            await tenantContents[accountName].feedbacks.list();
        
        res.status(200).send(data);
    } catch (error) {
        logger.error(null, `error while get feedbacks data ${res} ${error}`);
        res.status(500).send();
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});

async function isFeedbackEnabled(accountName: string): Promise<boolean> {
    const config = await tenantContents[accountName].config.load();

    return config.get("system_capability_flags.enable_feedback");
}
