import * as MicrosoftGraph from "@microsoft/microsoft-graph-client";
import {Logger} from 'healthbotcommon/logger';
import * as mainModel from "../../../models/admin-portal-v3/main.model";
import * as usersModel from "../../../models/admin-portal-v3/users/users.manage.model";
import * as auth from "../../../modules/auth";
import * as subscriptionHandlers from "../../../modules/subscriptionHandlers";
const express = require('express');
const rp = require('request-promise');
const logger = Logger.getInstance();
import "isomorphic-fetch";

export const router = express.Router();

const GRAPH_API_TIMEOUT = 5000;

router.use((req, res, next) => {
    req._navigation_path.push("manage");
    next();
});

router.get('/', async (req, res) => {
    try {
        const data = await mainModel.getData(req);
        logger.debug(null, `Open user management for account '${req.account.name}'`);
        // Check if has permission to access tenant's directory
        try {
            await rp({
                uri: `https://graph.microsoft.com/v1.0/users`,
                json: true,
                headers: {
                    Authorization : "Bearer " + req.user.accessToken
                },
                timeout: GRAPH_API_TIMEOUT
            });
            (data as any).directoryPermissions  = true;
            logger.debug(null, `Returned from graph api for account '${req.account.name}'`);

        }
        catch (err) {
            logger.debug(null, `Could not get users for account '${req.account.name}' error: ${err.message}`);
            (data as any).directoryPermissions = false;
        }
        res.render('admin-portal-v3/users/users.manage.ejs', data);
    }
    catch (error) {
        mainModel.pageNotFound(req, res, error);
    }
});

router.get("/all", async (req, res) => {
    const tenantUsers = await usersModel.getTenantUsers(req.account.id);
    res.status(200).send(tenantUsers);
});

router.get("/members", async (req, res) => {

    const client = MicrosoftGraph.Client.init( {
        authProvider: (done) => {
            done(undefined, req.user.accessToken);    
        }
    });        
    try {
        const groupsResult = await client.api(`/groups?$filter=startswith(displayName,'${req.query.filter}')&$top=20`).get();
        const usersResult = await client.api(`/users?$filter=startswith(displayName,'${req.query.filter}') or startswith(mail,'${req.query.filter}')&$top=20`).get();

        const groups = groupsResult.value.map ((m) => ({objectId: m.id, mail: m.displayName, name: ''}));

        const users = usersResult.value.map ((m) => {
            if (m.mail) {
                return {mail: m.mail, name: m.displayName};
            } else {
                return {mail: m.userPrincipalName, name: m.displayName};
            }
        });
        res.status(200).send(users.concat(groups));
    }
    catch (error) {
        res.status(200).send([]);
    }
});

router.post('/add', async (req, res) => {
    if (req.userRole < auth.UserRole.Admin) {
        return res.render('admin-portal-v3/error', {error: req.user.displayName + " is not authorized"});
    }
    if (req.userRole === auth.UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    for (const user of auth.getTenantUsersArray(req.account.id)) {
        if (user.email.toLowerCase() === req.body.email.toLowerCase()) {
            return res.status(401).send("This user already exists");
        }
    }
    try {
        await usersModel.addUser(req.account, req.body.role, req.body.email, req.body.objectId, req.user);
        await mainModel.sendEventToPortal({tenantId: req.account.id}, subscriptionHandlers.EventsNames.loadTenantUsers);
        res.status(200).send();
    } catch (error) {
        mainModel.sendErrToClient(res, error);

    }
});

router.get('/delete', async (req, res) => {
    if (req.userRole < auth.UserRole.Admin) {
        return res.render('admin-portal-v3/error', { error: req.user.displayName + " is not authorized" });
    }
    if (req.userRole === auth.UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        await usersModel.deleteUser(req.query.userId, req.account.id, req.user, req.account.name);
        await mainModel.sendEventToPortal({tenantId: req.account.id}, subscriptionHandlers.EventsNames.loadTenantUsers);
        setTimeout(() => {
            res.status(200).send();
        }, 1000);
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.patch('/role', async (req, res) => {
    if (req.userRole < auth.UserRole.Admin) {
        return res.status(403).send([]);
    }
    if (req.userRole === auth.UserRole.SystemAdmin && auth.isSysadminReadOnly(req.user, req.account)) {
        return res.status(403).send("System Admin in read only mode");
    }
    try {
        req.query.newRole = Number(req.query.newRole);
        const newRole = (req.query.newRole === auth.UserRole.Admin ? auth.UserRole.Admin : ((req.query.newRole === auth.UserRole.Editor ? auth.UserRole.Editor : auth.UserRole.Reader)));
        await usersModel.updateUserRole(req.account.id, req.query.userId, newRole, req.user, req.account.name);
        await mainModel.sendEventToPortal({tenantId: req.account.id}, subscriptionHandlers.EventsNames.loadTenantUsers);
        res.status(200).send();
    } catch (error) {
        mainModel.sendErrToClient(res, error);
    }
});

router.use((req, res) => {
    mainModel.pageNotFound(req, res);
});
