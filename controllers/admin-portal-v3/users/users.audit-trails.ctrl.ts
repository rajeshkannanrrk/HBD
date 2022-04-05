import { Logger } from "healthbotcommon/logger";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole, isSystemAdminEmail } from "../../../modules/auth";
import { tenantContents } from "../../../modules/globals";
import { GetAllConfig, GetAllResult } from "healthbotcommon/tenantcontent/auditTrailsClient";
import { Router } from "express";

const logger = Logger.getInstance();

export const router = Router();

const filterAuditTrailRes = (req) => ({ continuationToken, auditTrail }: GetAllResult) => req.userRole < UserRole.SystemAdmin ?
    { continuationToken, auditTrail: auditTrail.filter((item) => !isSystemAdminEmail(req.user, item.editor)) } :
    { continuationToken, auditTrail };

const stringifyAuditTrailRes = ({ continuationToken, auditTrail }: GetAllResult) => ({
    continuationToken: JSON.stringify(continuationToken),
    auditTrail: JSON.stringify(auditTrail)
});

router.use((req, res, next) => {
    req._navigation_path.push("audit-trails");
    next();
});

router.get('/', async (req, res) => {
    try {
        const [data, auditTrailRes] = await Promise.all([
            mainModel.getData(req),
            tenantContents[req.account.name].auditTrails.getPage({timeFrameInDays: 1})
                .then(filterAuditTrailRes(req))
                .then(stringifyAuditTrailRes)
        ]);
        res.render('admin-portal-v3/users/users.audit-trails.ejs', {
            ...data,
            ...auditTrailRes
        });
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/:continuationToken', async (req, res) => {
    try {
        const getAllConfig: GetAllConfig = {
            continuationToken: JSON.parse(req.params.continuationToken),
            timeFrameInDays: req.query.timeFrameInDays && Number(req.query.timeFrameInDays)
        };
        const auditTrails = await tenantContents[req.account.name].auditTrails.getPage(getAllConfig).then(filterAuditTrailRes(req));
        res.status(200).send(auditTrails);
    } catch (err) {
        logger.error(null, `Error while fetching audit trail for ${req.account.name} - ${err}`);
        mainModel.sendErrToClient(res, err);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
