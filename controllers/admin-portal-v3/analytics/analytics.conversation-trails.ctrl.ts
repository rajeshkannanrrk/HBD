import { Router } from 'express';
import * as moment from 'moment';
import { Logger } from 'healthbotcommon/logger';
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { UserRole } from '../../../modules/auth';
import { errorHandlers, requireRole, requireSysAdminWriteMode } from '../../../middlewares/auth';
import { tenantContents } from '../../../modules/globals';
import { logConversationLogsDataExported, logDataRetentionChange } from '../../../services/auditTrailsLogger';

const logger = Logger.getInstance();
const requireAdminRole = requireRole(UserRole.Admin, errorHandlers.statusForbidden("Editors and Readers are not allowed for this operations"));

export const router = Router();

function processQueryParams(queryParams) {
    if (!queryParams.startDate || !queryParams.endDate) {
        throw new Error("missing date range");
    }

    const startDate = moment(Number(queryParams.startDate)).utc().format();
    const endDate = moment(Number(queryParams.endDate)).utc().format();

    if (startDate > endDate) {
        throw new Error("invalid date range");
    }

    const userId: string = queryParams.userId || null;

    return { startDate, endDate, userId };
}

router.use((req, _, next) => {
    req._navigation_path.push("conversation-logs");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/analytics/analytics.conversation-trails.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/dataRetentionPolicy', async (req, res) => {
    try {
        const tenantConfig = await tenantContents[req.account.name].config.load();

        res.status(200).send({
            dataRetentionDays: tenantConfig.get("dataRetentionDays")
        });
    }
    catch (err) {
        return mainModel.sendErrToClient(res, err);
    }
});

router.post('/dataRetentionPolicy', requireAdminRole, requireSysAdminWriteMode(), async (req, res) => {
    try {
        const tenantConfig = await tenantContents[req.account.name].config.getOverrides();

        tenantConfig.dataRetentionDays = req.body.retentionPeriod;

        await tenantContents[req.account.name].config.save(tenantConfig);
        logDataRetentionChange(req.account.name, req.user.emails[0].value, req.body.retentionPeriod);

        return res.status(200).send();
    }
    catch (err) {
        return mainModel.sendErrToClient(res, err);
    }
});

router.get('/export', requireAdminRole, requireSysAdminWriteMode(), async (req, res) => {
    let queryParams: ReturnType<typeof processQueryParams>;

    try {
        queryParams = processQueryParams(req.query);
    } catch (e) {
        return mainModel.sendErrToClient(res, e);
    }

    try {
        logConversationLogsDataExported(req.account.name, req.user.emails[0].value, queryParams.startDate, queryParams.endDate, queryParams.userId);
        res.statusCode = 200;
        res.setHeader('Content-type', 'application/csv');
        res.setHeader('Content-disposition', `attachment; filename=Conversation_logs_${moment(Number(req.query.requestDate)).format("YYYY_MM_DD_hh_mm")}.csv`);
        res.write([
            "Date",
            "Time (UTC)",
            "Conversation ID",
            "UserID",
            "Speaker",
            "Message",
            "Attachments"
        ].join(",") + "\r\n");

        const iterator = queryParams.userId ?
            tenantContents[req.account.name].conversationTrails.getByUserId(queryParams.userId, new Date(queryParams.startDate), new Date(queryParams.endDate)) :
            tenantContents[req.account.name].conversationTrails.getAll(new Date(queryParams.startDate), new Date(queryParams.endDate));

        const addCsvSupport = (text: string) => `"${text.replace(/"/g, "\"\"")}"`;

        for await (const log of iterator) {
            res.write([
                moment(log.messageCreatedAt).utc().format("YYYY-MM-DD"),
                moment(log.messageCreatedAt).utc().format("HH:mm:ss:SSS"),
                log.conversationId,
                log.userId,
                log.speaker,
                addCsvSupport(log.messageText),
                log.attachments ? addCsvSupport(JSON.stringify(log.attachments)) : '""'
            ].join(",") + "\r\n");
            res.flushHeaders();
        }
    } catch (error) {
        res.write(`\n\n*** unexpected error occurred, please export the file again ***\n`);
        logger.exception(null, error);
    }

    res.end();
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
