import {TenantDeletionStatus, IFxAuditEventCategory, IFxAuditIdentityType, IFxAuditResultType } from "healthbotcommon/enums";
import {HealthBotUtils} from 'healthbotcommon/healthbotutils';
import {Logger} from 'healthbotcommon/logger';
import * as passport from "passport";
import * as uuid from 'node-uuid';
import { AzureTableServiceAsync } from "healthbotcommon/azurestorageasync/azuretableserviceasync";
const azure = require('azure-storage');
const config = require('config');
const _ = require('underscore');
const moment = require('moment');
const refreshStrategy = require('passport-oauth2-refresh');
const rp = require('request-promise');
const globals = require('./globals');

const logger = Logger.getInstance();

let tableSvc: AzureTableServiceAsync = null;

const tenantsUsers: Record<string, any> = {};

export enum UserRole {
    SystemAdmin = 5,
    Admin = 4,
    Editor = 3,
    Reader = 2,
    CSS = 1,
    None = 0
}

export function use(app) {
    initPassport(app);
    app.use( async (req, res, next) => {
        if (req.path.startsWith("/auth/")) {
            return next();
        }

        if (req.path.startsWith("/favicon.ico")) {
            return next();
        }
        // Set account name from url (if mentioned)
        const pathSplit = req.path.match(/\/account\/([\w-]+)/);
        const accountName = (pathSplit != null) ? pathSplit[1] : undefined;
        if (accountName) {
            if (globals.tenants[accountName] && !tenantsUsers.hasOwnProperty(globals.tenants[accountName].id)) { // If tenant doesn't exist in our map
                await loadTenantUsers(globals.tenants[accountName].id); // Need to add tenant and its users to the map
            }
        }
        req.session.accountName = accountName;
        if (!req.isAuthenticated()) {
            if (!accountName) {
                res.status(404);
                return res.render('admin-portal-v3/error', { error: 'Page not found' });
            }
            rememberSourcePath(req.session, req.path);
            if (req.headers["x-is-angular"]) {
                return res.status(401).send();
            }
            return res.redirect('/auth/' + getUserManagement(accountName));
        }

        res.clearCookie("healthbot.sid");
        res.clearCookie("time_to_idle");
        res.clearCookie("time_to_timeout");
        res.cookie('healthbot.idle', new Date().getTime() + (config.get('redis.portal.session.almost_timeout_notification_in_seconds') * 1000), { maxAge: config.get('redis.portal.session.almost_timeout_notification_in_seconds') * 1000 });
        res.cookie('healthbot.timeout', new Date().getTime() + (config.get('redis.portal.session.timeout_in_seconds') * 1000), { maxAge: config.get('redis.portal.session.timeout_in_seconds') * 1000});

        if (req.path.startsWith("/activity")) {
            return next();
        }

        if (req.path.startsWith("/logout")  ||
            req.path.startsWith("/favicon.ico")) {
            return next();
        }

        if (accountName && (accountName.length > 0) && globals.tenants[accountName]) {
            if (getUserManagement(accountName) === 'aad' && req.user.strategy !== 'aad') {
                if (!isSystemAdmin(req.user)) {
                    const baseUrl = req.path;
                    return logout(req).then(() => {
                        res.redirect(baseUrl);
                    }).catch((err) => {
                        res.render('admin-portal-v3/error', { error: 'Sorry, something went wrong.\n Please try to refresh this page' });
                    });

                }
            }
        }

        req.userRole = UserRole.None;
        req.account = globals.tenants[accountName];
        req.evaluation = globals.evaluations[accountName];
        req.accountRootPath = "/account/" + accountName + "/";
        req.userRole = (isSystemAdmin(req.user)) ? UserRole.SystemAdmin :
            (isCSS(req.user)) ? UserRole.CSS :
                getUserRole(req.user, req.account, req.evaluation, (req.account && req.account.usermanagement && req.account.usermanagement === 'aad') ? 'aad' : 'windowslive');

        if (req.userRole === UserRole.SystemAdmin && accountName && globals.tenants[accountName]) {
            const prevTS = req.user.sysadminsWriteMap[req.user.emails[0].value][globals.tenants[accountName].RowKey];
            if (prevTS) {
                const currTS = moment().subtract(1 , 'hours');
                if (currTS > prevTS) {
                    delete req.user.sysadminsWriteMap[req.user.emails[0].value][globals.tenants[accountName].RowKey];
                }
            }
        }
        if (req.path.startsWith("/account/")) {
            if (!accountName) {
                return res.render('admin-portal-v3/error', { error: 'Account name not specified' });
            }
            if (!globals.tenants[accountName]) {
                return res.render('admin-portal-v3/error', { error: '"' + accountName + '" is not a valid account name' });
            }
            if (req.account.customDomain && req.account.customDomain !== req.hostname){
                logger.info(null, `redirecting from ${req.hostname} to custom domain ${req.account.customDomain }`);
                return res.redirect(301, `https://${req.account.customDomain}${req.originalUrl}`);
            }
            if (req.userRole === UserRole.None) {
                return res.render('admin-portal-v3/error', { error: req.user.emails[0].value + '\n\nAccess denied' });
            }
            // Check if need to refresh token
            if (req.user.refreshToken && moment(req.user.expires).diff(moment(), 'seconds') < 0) {
                refreshStrategy.requestNewAccessToken(req.user.strategy + "-strategy", req.user.refreshToken, async (err, accessToken, refreshToken) => {
                    if (!err) {
                        updateRefreshedToken(req.user, accessToken, refreshToken);
                        // Reload all users from groups
                        await Promise.all([
                            loadSysAdmins(req),
                            loadCustomerServices(req),
                            loadTenantGroupUsers(req)
                        ]);
                        return next();
                    }
                    return res.render('admin-portal-v3/error', { error: "Refresh token failed" });
                });
            }
            else {
                return next();
            }
        } else {
            // other routes not supported - return regular HTTP status 404: NotFound
            res.status(404);
            return res.render('admin-portal-v3/error', { error: 'Page not found' });
        }
    });
}

export async function init(app, secrets, tsvc: AzureTableServiceAsync) {
    tableSvc = tsvc;
    initStrategies(app, secrets);
}

export async function loadTenantUsersAsync(tenantId: string) {
    return loadTenantUsers(tenantId);
}

async function loadTenantUsers(tenantId: string) {
    try {
        const query = new azure.TableQuery().where('PartitionKey eq ?', tenantId);
        const users = await tableSvc.queryEntities('users', query, null);
        tenantsUsers[tenantId] = {};
        if (users && users.length > 0) {
            for (const user of users) {
                addUserToTenant(tenantsUsers[tenantId], user);
            }
        } else {
            logger.info(null, "no users listed for tenant %s", tenantId);
        }
    }
    catch (error) {
        logger.error(null, "Failed to read users list from storage for tenant %s", tenantId);
    }
}

/**
 * Load group users for the logged user
 *
 * @param req
 */
export async function loadTenantGroupUsers(req) {
    const tenantId = globals.tenants[req.session.accountName].id;
    if (tenantId) {
        const users: any = tenantsUsers[tenantId];
        req.user.groupUsers = {};
        for (const user in users) {
            if (users[user].objectId) {
                try {
                    const members = await rp({
                        uri: `https://graph.microsoft.com/v1.0/groups/${users[user].objectId}/members`,
                        json: true,
                        headers: {
                            Authorization : "Bearer " + req.user.accessToken
                        }
                    });
                    // Add user from the group
                    for (const member of members.value) {
                        const newUserObj = JSON.parse(JSON.stringify(users[user]));
                        newUserObj.email = member.userPrincipalName;
                        addUserToTenant(req.user.groupUsers, newUserObj);
                    }
                }
                catch (err) {
                    logger.info(null, `group ${users[user].email} is not found under the current user's directory`);
                }
            }
        }
    }
}

function addUserToTenant(usersDictionary, user) {
    const userObj = {
        RowKey: user.RowKey,
        isAdmin: user.isAdmin || false,
        isEditor: user.isAdmin || user.isEditor || false,
        isReader: user.isAdmin || user.isEditor || user.isReader || false,
        email: user.email,
        objectId: user.objectId
    };
    const existingUser = usersDictionary[user.email.toLowerCase()];
    if (!existingUser || getUserRoleLevel(user) > getUserRoleLevel(existingUser)) {
        usersDictionary[user.email.toLowerCase()] = userObj;
    }
}

export function isSysadminReadOnly(user, account) {
    const isDevEnv = process.env.HOST.indexOf('dev') >= 0;
    if (isDevEnv) {
        return false;
    }
    return user.sysadminsWriteMap[user.emails[0].value][account.RowKey] === undefined;
}

export function sysadminReadonlyToggle(user, account) {
    const isDevEnv = process.env.HOST.indexOf('dev') >= 0;
    if (isDevEnv) {
        return false;
    }
    if (user.sysadminsWriteMap[user.emails[0].value][account.RowKey]) {
        delete user.sysadminsWriteMap[user.emails[0].value][account.RowKey];
        return true;
    } else {
        user.sysadminsWriteMap[user.emails[0].value][account.RowKey] = moment();
        return false;
    }
}

export function getTenantUsersArray(tenantId) {
    const arr = [];
    for (const key of Object.keys(tenantsUsers[tenantId])) {
        arr.push(tenantsUsers[tenantId][key]);
    }
    return arr;
}

function isSystemAdmin(user) {
    return (user && user.emails && isSystemAdminEmail(user, user.emails[0].value.toLowerCase()));
}

function isCSS(user) {
    return (user && user.emails && isCSSEmail(user, user.emails[0].value.toLowerCase()));
}

function isEvaluationExpired(account) {
    return account.endsAt && moment(account.endsAt).diff(moment(), 'days') < 0;
}

function updateRefreshedToken(userProfile, accessToken, refreshToken) {
    userProfile.accessToken = accessToken;
    userProfile.refreshToken = refreshToken;
    userProfile.expires = moment().add(userProfile.expires_in, 'seconds');
}

export function isSystemAdminEmail(user, mail) {
    return _.indexOf(user.sysAdmins, mail) >= 0;
}

export function isCSSEmail(user, mail) {
    return _.indexOf(user.customerServices, mail) >= 0;
}

function initPassport(app) {
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser((user, cb) => cb(null, user));
    passport.deserializeUser((obj, cb) => cb(null, obj));
}
function initStrategies(app, secrets) {

    app.get('/auth/failure', (req, res) => res.render('admin-portal-v3/error', { error: 'Authentication failed.<br>Please contact your system administrator'}));
    app.post('/logout', async (req, res) => {
        try {
            if (req.user.emails.length > 0 && req.session.baseUrl) {
                const accountName = req.session.baseUrl.match(/\/account\/(.*?)\/.*/);
                if (accountName){
                    logger.audit("ManagementPortalLogout", IFxAuditResultType.Success, IFxAuditEventCategory.applicationManagement, IFxAuditIdentityType.UPN, req.user.emails[0].value, "service", accountName[1]);
                }
            }
            await logout(req);
            res.status(200).send();
        }
        catch (e) {
            if (req.user.emails.length > 0 && req.session.baseUrl) {
                const accountName = req.session.baseUrl.match(/\/account\/(.*?)\/.*/);
                if (accountName){
                    logger.audit("ManagementPortalLogout", IFxAuditResultType.Fail, IFxAuditEventCategory.applicationManagement, IFxAuditIdentityType.UPN, req.user.emails[0].value, "service", accountName[1]);
                }
            }
            res.status(500).send();
        }
    });

    const jwt = require('jsonwebtoken');
    const AzureAdOAuth2Strategy = require('passport-azure-ad-oauth2');
    const authOptions = {
        prompt: "select_account",
        state: undefined,
        scope: ['openid', 'profile', 'offline_access', 'User.Read', 'UserActivity.ReadWrite.CreatedByApp']
    };
    const authFailureOptions = { failureRedirect: '/auth/failure' };

    for (const strategyName of Object.keys(secrets)) {
        logger.debug(null, "[auth] registering auth strategy - %s", strategyName);
        app.get('/auth/' + strategyName, (req, res, next) => {
            authOptions.state = req.session.baseUrl;
            next();
        });
        app.get('/auth/' + strategyName, passport.authenticate(strategyName + '-strategy', authOptions));
        app.get('/auth/' + strategyName + '/callback',
            passport.authenticate(strategyName + '-strategy', authFailureOptions),
            async (req, res) => {

                // Get sysadmins and css and place it on the session
                if (req.session.accountName && globals.tenants[req.session.accountName]) {
                    await Promise.all([
                        loadSysAdmins(req),
                        loadCustomerServices(req),
                        loadTenantGroupUsers(req)
                    ]);

                    const account = globals.tenants[req.session.accountName];
                    const userRole = (isSystemAdmin(req.user))
                        ? UserRole.SystemAdmin
                        : (isCSS(req.user))
                            ? UserRole.CSS
                            : getUserRole(req.user, account, globals.evaluations[req.session.accountName], (account && account.usermanagement && account.usermanagement === 'aad') ? 'aad' : 'windowslive');

                    if (userRole !== UserRole.None) {
                        logger.audit("ManagementPortalLogin", IFxAuditResultType.Success, IFxAuditEventCategory.applicationManagement, IFxAuditIdentityType.UPN, req.user.emails[0].value, "service", req.session.accountName, {userRole: UserRole[userRole]});
                    } else {
                        logger.audit("ManagementPortalLogin", IFxAuditResultType.Fail, IFxAuditEventCategory.applicationManagement, IFxAuditIdentityType.UPN, req.user.emails[0].value, "service", req.session.accountName, {userRole: UserRole[userRole]});
                    }
                }

                if (req.query.state) {
                    return res.redirect(req.query.state);
                }
                else if (req.session.baseUrl) {
                    return res.redirect(req.session.baseUrl);
                }
                else {
                    return res.render('admin-portal-v3/error', { error: 'Oops, Something went wrong.' });
                }
            }
        );
        const strategy = new AzureAdOAuth2Strategy({
            authorizationURL: config.get('auth.' + strategyName + '.authorize_uri'),
            tokenURL: config.get('auth.' + strategyName + '.token_uri'),
            clientID: config.get('auth.' + strategyName + '.client_id'),
            clientSecret: secrets[strategyName],
            callbackURL: config.get('auth.' + strategyName + '.redirect_uri')
        },
        (accessToken, refreshToken, params, profile, cb) => {
            const decodedToken = jwt.decode(params.id_token);
            const userProfile = {
                displayName: decodedToken.name,
                emails : [ {value: decodedToken.preferred_username.toLowerCase()}],
                roles: decodedToken.roles,
                tenantID: decodedToken.tid,
                strategy: strategyName,
                expires_in: params.expires_in,
                objectId: decodedToken.oid,
            };

            let errObject = null;
            if (decodedToken.idp) {
                const correlationId = uuid.v4();
                const errMessage = `External Identity Provider ${decodedToken.idp} not supported. Please contact healthbotsupport@microsoft.com. Correlation Id: ${correlationId}`;
                logger.error({logContext: {
                    idp: decodedToken.idp,
                    iss: decodedToken.iss,
                    tid: decodedToken.tid                    
                }}, errMessage);
                errObject = new Error(errMessage);
            } else {
                updateRefreshedToken(userProfile, accessToken, refreshToken);
            }
            return cb(errObject, userProfile);
        });
        strategy.name = strategyName + "-strategy";
        passport.use(strategy);
        refreshStrategy.use(strategy);
    }
}

async function loadSysAdmins(req) {
    try {
        const objId = config.get('auth.windowslive.sysadmins-sg-objid');

        const result = await rp({
            uri: `https://graph.microsoft.com/v1.0/groups/${objId}/members`,
            json: true,
            headers: {
                Authorization : "Bearer " + req.user.accessToken
            }
        });
        logger.debug(null, `Loaded members of a group ${objId}`);
        req.user.sysAdmins = result.value.map((member) => member.userPrincipalName.toLowerCase());
    }
    catch (err) {
        req.user.sysAdmins = [];
    }
    finally {
        // on loading - map of empty values, so all the sys admins are in read only mode at all tenants.
        const sysadminsWriteMap = {};
        for (const sysAdmin of req.user.sysAdmins) {
            sysadminsWriteMap[sysAdmin] = {};
        }
        req.user.sysadminsWriteMap = sysadminsWriteMap;
    }
}

async function loadCustomerServices(req) {
    try {

        const objId = config.get('auth.windowslive.css-sg-objid');

        const result = await rp({
            uri: `https://graph.microsoft.com/v1.0/groups/${objId}/members`,
            json: true,
            headers: {
                Authorization : "Bearer " + req.user.accessToken
            }
        });

        logger.debug(null, `Loaded members of a group ${objId}`);
        req.user.customerServices = result.value.map((member) => member.mail.toLowerCase());
    }
    catch (err) {
        req.user.customerServices = [];
    }
}
function getUserRoleLevel(userObj): UserRole {
    if (userObj.isAdmin) {
        return UserRole.Admin;
    }
    if (userObj.isEditor) {
        return UserRole.Editor;
    }
    if (userObj.isReader) {
        return UserRole.Reader;
    }
}

export function getTenantUser(tenantId: string, reqUser) {
    const userEmail = reqUser.emails[0].value.toLowerCase();
    return tenantsUsers[tenantId][userEmail];
}

function getUserRole(user, account, evaluation, strategy): UserRole {
    let role = UserRole.None;
    if (!account || account.deletionStatus === TenantDeletionStatus.DISABLED) {
        return role;
    }
    switch (strategy) {
        case "aad":
            if (user.tenantID === account.tenantid && user.roles) {
                for (const r of user.roles) {
                    switch (r) {
                        case "reader":
                            role = Math.max(role, UserRole.Reader);
                            break;
                        case "editor":
                            role = Math.max(role, UserRole.Editor);
                            break;
                        case "admin":
                            role = Math.max(role, UserRole.Admin);
                            break;
                    }
                }
            }
            break;
        case "windowslive":
            const userEmail = user.emails[0].value.toLowerCase();
            const tenantUser = tenantsUsers[account.id][userEmail] || (user.groupUsers && user.groupUsers[userEmail]);
            if (tenantUser && HealthBotUtils.isUserInAccountDomainsList(account, user.emails[0].value)) {
                role = (tenantUser.isAdmin) ? UserRole.Admin :
                    (tenantUser.isEditor) ? UserRole.Editor :
                        UserRole.Reader;
            }
            break;
    }
    // Check if the evaluation expired - if so, user role is reader
    if (role !== UserRole.None && isEvaluationExpired(account)) {
        role = UserRole.Reader;
    }
    return role;
}

function getUserManagement(accountName): string {
    if (accountName && (accountName.length > 0) && !globals.tenants[accountName]) {
        return 'windowslive';
    }
    return (accountName && globals.tenants[accountName].usermanagement && globals.tenants[accountName].usermanagement === 'aad') ? 'aad' : 'windowslive';
}

function rememberSourcePath(session, path) {
    if (session) {
        session.baseUrl = path;
    }
}

async function logout(req) {
    await req.session.destroy();
}

export function updateCustomerServices(list) {
    // Do nothing - should remove call
}
