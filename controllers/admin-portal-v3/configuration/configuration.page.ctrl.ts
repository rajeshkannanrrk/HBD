import {Logger} from 'healthbotcommon/logger';
const logger = Logger.getInstance();
import { Router } from "express";
import { mergeLocalizationObjects, defaultLocalizationClient } from 'healthbotcommon/tenantcontent/localization';
import * as localizationModel from "../../../models/admin-portal-v3/language-models/configuration.localization.model";
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import { ConfigurationPageModel } from "../../../models/admin-portal-v3/configuration/configuration.page.model";
import { tenantContents } from '../../../modules/globals';
const auth = require('../../../modules/auth');
const UserRole = require("../../../modules/auth").UserRole;

export function createRouter(pageName: string, ejsPath: string, model: ConfigurationPageModel): Router {
    const router = Router();
    if (ejsPath) {
        router.use((req, res, next) => {
            req._navigation_path.push(pageName);
            next();
        });

        router.get('/', async (req, res) => {
            try {
                const data = await mainModel.getData(req);
                res.render(ejsPath, data);
            }
            catch (error) {
                mainModel.pageNotFound(req, res, error);
            }
        });
    }

    router.get("/read", async (req, res) => {
        try {
            const data = await model.read(req.account, req.userRole >= UserRole.SystemAdmin);
            res.status(200).send(data);
        } catch (error) {
            mainModel.sendErrToClient(res, error);
        }
    });

    router.put("/save", async (req, res) => {
        if (req.userRole < UserRole.Editor) {
            return res.status(403).send("Readers not allowed for this operations");
        }
        if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account) && req.query.force !== "true") {
            return res.status(403).send("System Admin in read only mode");
        }
        try {
            logger.info(null, `Updating configuration for ${req.account.name}: ${req.baseUrl.split("/").splice(3).join(" > ")}`);
            await model.saveData(req.account, req.body, req.userRole >= UserRole.SystemAdmin, req.user);
            mainModel.io.to(req.account.id).emit('configurationChanged', {user: req.user.displayName + " (" + req.user.emails[0].value + ")"});
            return res.status(200).send();
        } catch (error) {
            mainModel.sendErrToClient(res, error);
        }
    });

    router.put("/reset", async (req, res) => {
        if (req.userRole < UserRole.Editor) {
            return res.status(403).send("Readers not allowed for this operations");
        }
        if (req.userRole === UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account) && req.query.force !== "true") {
            return res.status(403).send("System Admin in read only mode");
        }
        try {
            logger.info(null, `Resetting configuration for ${req.account.name}: ${req.baseUrl.split("/").splice(3).join(" > ")}`);
            await model.saveData(req.account, null, req.userRole >= UserRole.SystemAdmin, req.user);
            mainModel.io.to(req.account.id).emit('configurationChanged', {user: req.user.displayName + " (" + req.user.emails[0].value + ")"});
            return res.status(200).send();
        } catch (error) {
            mainModel.sendErrToClient(res, error);
        }
    });

    router.get('/specificLocalizedStrings', async (req, res) => {
        try {
            const systemLocalizedStrings = await tenantContents[req.account.name].localization.system.get();
            const localizedStrings = mergeLocalizationObjects(defaultLocalizationClient.get(), systemLocalizedStrings);

            res.status(200).json(localizationModel.filterBySubstring(req.query.partOfString.toString(), localizedStrings));
        }
        catch (error) {
            mainModel.sendErrToClient(res, error);
        }
    });

    router.use((req, res) => {
        mainModel.pageNotFound(req, res);
    });

    return router;
}
