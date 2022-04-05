import * as mainModel from "../../../models/admin-portal-v3/main.model";
import * as scenarioSearchModel from "../../../models/admin-portal-v3/scenarios/scenarios.search.model";
import { tenantContents } from "../../../modules/globals";
const rp = require('request-promise');
const express = require('express');
const config = require('config');

export const router = express.Router();

router.use((req, res, next) => {
    req._navigation_path.push("search");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        res.render('admin-portal-v3/scenarios/scenarios.search.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});
/* eslint-disable */
function decodeBase64(s: string) {
    const e = {};let b = 0;let c;let l = 0;let a;let r = '';const w = String.fromCharCode;const L = s.length;
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0; i < 64; i++) {e[A.charAt(i)] = i;}
    for (let x = 0; x < L; x++){c = e[s.charAt(x)];b = (b << 6) + c;l += 6;
        while (l >= 8) {((a = (b >>> (l -= 8)) & 0xff) || (x < (L - 2))) && (r += w(a));}
    }
    return r;
}
/* eslint-enable */

router.post("/", async (req, res) => {
    const options: any = {};
    options.uri = `${config.get("search_server_url")}&search=${req.query.phrase}&highlightPreTag=<span class='search-scenario-match'>&highlightPostTag=</span>&highlight=content&$count=true`;
    options.method = "GET";
    options.headers = {};
    options.headers["api-key"] = await scenarioSearchModel.getSearchApiKey();
    options.json = true;
    rp(options).then(async (result) => {
        const scenariosMap = {};
        const accountScenarios = await tenantContents[req.account.name].scenarios.listLightScenarios();
        accountScenarios.forEach((scenario) => {
            scenariosMap[scenario.RowKey] = {
                name: scenario.name
            };
        });
        const data = [];

        result.value.forEach((item) => {
            if (decodeBase64(item.metadata_storage_path).indexOf("scenarios/" + req.account.name + "/") > -1) {
                const id = item.metadata_storage_name;
                if (scenariosMap[id] && item["@search.highlights"] && item["@search.highlights"].content) {
                    data.push({
                        id,
                        scenarioDetails : scenariosMap[id],
                        content : item["@search.highlights"].content[0],
                    });
                }
            }
        });
        res.status(200).send(data);
    }).catch((err) => {
        mainModel.sendErrToClient(res, err);
    });
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
