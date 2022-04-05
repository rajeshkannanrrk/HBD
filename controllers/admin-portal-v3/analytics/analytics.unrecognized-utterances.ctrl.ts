import { Router } from "express";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { tenantContents } from "../../../modules/globals";

export const router = Router();

router.use((req, _, next) => {
    req._navigation_path.push("unrecognized-utterances");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/analytics/analytics.unrecognized-utterances.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get('/read', async (req, res) => {
    try {
        const continuationToken = req.query.continuationToken?.toString();
        const range = req.query.range?.toString();
        const client = tenantContents[req.account.name].misunderstoodUtterances;
        const data = await client.getPage(continuationToken && JSON.parse(continuationToken), client.isValidRange(range) ? range : null);
        res.status(200).send({
            ...data,
            items: data.items.map(({ text, timestamp }) => ({
                full: text,
                short: getShortText(text),
                timestamp
            }))
        });
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.post('/export', async (req, res) => {
    try {
        const data = await tenantContents[req.account.name].misunderstoodUtterances.export();
        res.status(200).send(data);
    } catch (err) {
        mainModel.sendErrToClient(res, err);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});

function getShortText(text) {
    let firstRow = text.split("\n")[0].substr(0, 100);
    if (firstRow !== text) {
        firstRow += "...";
    }
    return firstRow;
}
