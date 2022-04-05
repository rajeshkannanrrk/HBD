import * as reportsModel from "../../../models/admin-portal-v3/analytics/analytics.reports.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
const express = require('express');
const moment = require('moment');
export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("reports");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/analytics/analytics.reports.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

function createTimedQueryParams(mode: string) {
    let workingMode: reportsModel.Mode;
    let fromTime: string;
    let toTime: string;
    switch (mode) {
        case "24 hours":
            workingMode = reportsModel.Mode.HOURS;
            fromTime = moment.utc().subtract(23, 'hours').format("YYYY-MM-DDTHH:00:00.000");
            toTime = moment.utc().add(1, 'hour').format("YYYY-MM-DDTHH:00:00.000");
            break;
        case "7 days":
            workingMode = reportsModel.Mode.DAYS;
            fromTime = moment().subtract(6, 'days').format("YYYY-MM-DDT00:00:00.000z");
            toTime = moment().add(1, 'day').format("YYYY-MM-DDT00:00:00.000z");
            break;
        case "30 days":
            workingMode = reportsModel.Mode.DAYS;
            fromTime = moment().subtract(29, 'days').format("YYYY-MM-DDT00:00:00.000z");
            toTime = moment().add(1, 'day').format("YYYY-MM-DDT00:00:00.000z");
            break;
        case "90 days":
            workingMode = reportsModel.Mode.DAYS;
            fromTime = moment().subtract(89, 'days').format("YYYY-MM-DDT00:00:00.000z");
            toTime = moment().add(1, 'day').format("YYYY-MM-DDT00:00:00.000z");
            break;
        case "Monthly":
            workingMode = reportsModel.Mode.MONTHS;
            fromTime = moment().subtract(2, 'months').format("YYYY-MM-01T00:00:00.000z");
            toTime = moment().add(1, 'month').format("YYYY-MM-DDT00:00:00.000z");
            break;
        default: // mode is a calendar month (e.g. "Aug 2018")
            workingMode = reportsModel.Mode.DAYS;
            fromTime = moment(new Date(mode)).format("YYYY-MM-01T00:00:00.000z");
            toTime = moment(new Date(mode)).add(1, 'month').format("YYYY-MM-01T00:00:00.000z");
    }
    return {workingMode, from: fromTime, to: toTime};
}

router.get('/reportData', async (req, res) => {
    try {
        const queryName = req.query.name;
        const accountName = req.account.name;
        const mode = req.query.mode;
        const params = createTimedQueryParams(mode);
        if (accountName.match(/cdc-covid19-healthbot-zsa3lqk/ig)) {
            const loadTestEnd = "2020-03-19T14:30:00.000";
            params.from = params.from < loadTestEnd ? loadTestEnd : params.from;
        }
        if (queryName === "customScenarioCompletion") {
            const isDevEnv = process.env.HOST.indexOf('dev') >= 0;
            if (!isDevEnv) {
                const relevantTime = "2020-04-03T00:00:00.000";
                params.from = params.from < relevantTime ? relevantTime : params.from;
            }
        }
        const result = await reportsModel[queryName](accountName, params.workingMode, params.from, params.to, req.query.top);
        res.status(200).send(result);
    }
    catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
