import { HealthBotUtils } from 'healthbotcommon/healthbotutils';
import { Logger } from 'healthbotcommon/logger';
import { UserRole } from "../../../modules/auth";
import { TableUtilities, TableQuery } from "azure-storage";
import * as mainModel from "../main.model";
import { logUserChange } from "../../../services/auditTrailsLogger";

const entGen = TableUtilities.entityGenerator;
const logger = Logger.getInstance();
const uuid = require('node-uuid');

export async function addUser(reqAccount, reqBodyRole, reqBodyEmailLowerCase, objectId, editor) {
    logger.debug(null, "adding new user");
    if (!HealthBotUtils.isUserInAccountDomainsList(reqAccount, reqBodyEmailLowerCase)) {
        throw new Error("User is not in an allowed domain");
    }
    const user = {
        RowKey : entGen.String(uuid.v4()),
        PartitionKey: entGen.String(reqAccount.id),
        email: entGen.String(reqBodyEmailLowerCase),
        objectId: entGen.String(objectId),
        isAdmin: reqBodyRole >= UserRole.Admin,
        isEditor: reqBodyRole >= UserRole.Editor,
    };
    await mainModel.tenantCosmosTableService.insertOrReplaceEntity("users", user);
    logUserChange(reqAccount.name, "created", editor.emails[0].value, reqBodyEmailLowerCase, reqBodyRole);
}

export async function deleteUser(userId, accountId, editor, accountName) {
    logger.debug(null, "delete user id " + userId);
    if ((await getTenantUsers(accountId))
        .filter((user) => user.RowKey !== userId)
        .filter((user) => user.isAdmin)
        .length === 0) {
        throw new Error("Tenant must have at least one admin");
    }
    const deletedUser = await mainModel.tenantCosmosTableService.retrieveDeleteEntity('users', accountId, userId);
    logUserChange(accountName, "deleted", editor.emails[0].value, deletedUser.email, deletedUser.isAdmin ? UserRole.Admin : deletedUser.isEditor ? UserRole.Editor : UserRole.Reader);
}

export async function getTenantUsers(accountId: string) {
    const query = new TableQuery().where("PartitionKey eq ?", accountId);
    let continuationToken = null;
    const users = [];
    do {
        const response = await mainModel.tenantCosmosTableService.queryEntitiesWithContinuationToken("users", query, continuationToken);
        users.push(...response.value);
        continuationToken = response.continuationToken;
    } while (continuationToken);

    return users;
}

export async function updateUserRole(accountId, userId, newRole, editor, accountName) {
    if ((await getTenantUsers(accountId))
        .filter((item) => {
            if (item.RowKey === userId) {
                return newRole >= UserRole.Admin;
            }
            return item.isAdmin;
        }).length === 0) {
        throw new Error("Tenant must have at least one admin");
    }
    const userObject = await getDBUser(accountId, userId);
    const user = getUserToUpdate(userObject);
    user.isAdmin = entGen.Boolean(newRole >= UserRole.Admin);
    user.isEditor = entGen.Boolean(newRole >= UserRole.Editor);
    await mainModel.tenantCosmosTableService.insertOrReplaceEntity("users", user);
    logUserChange(accountName, "modified", editor.emails[0].value, userObject.email, newRole);
}

async function getDBUser(tenantId: string, userId: string): Promise<any> {
    const query = new TableQuery().where('PartitionKey eq ? and RowKey eq ?', tenantId, userId);
    const userObjects = await mainModel.tenantCosmosTableService.queryEntities('users', query, null);
    if (!userObjects || userObjects.length == 0) {
        throw new Error("can't find user");
    }
    return userObjects[0];
}

const privateFunctions = {};

function getUserToUpdate(userObject): any{
    const user = {
        PartitionKey: entGen.String(userObject.PartitionKey),
        RowKey : entGen.String(userObject.RowKey),
        email: entGen.String(userObject.email),
        isAdmin: entGen.Boolean(userObject.isAdmin),
        isEditor: entGen.Boolean(userObject.isEditor),
        objectId: entGen.String(userObject.objectId),
    };
    return user;
}

if (process.env.NODE_UNITTEST === 'true') {
    module.exports.privateFunctions = privateFunctions;
}
