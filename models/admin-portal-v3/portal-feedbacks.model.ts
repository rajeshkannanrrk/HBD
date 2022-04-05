import * as emails from "healthbotcommon/emails";
import * as uuid from 'node-uuid';
import { KeyVault } from "healthbotcommon/keyvault";
import { Logger } from 'healthbotcommon/logger';
import { HealthBotUtils } from "healthbotcommon/healthbotutils";
import { Survey, SurveyStatus, TENANT_SATISFACTION_SURVEY_ID, InitialSurveyData } from "../../modules/surveyModule";
import { TableUtilities, TableQuery } from "azure-storage";
import { tenantStorageTableService, tenantCosmosTableService } from "./main.model";
import * as auth from "../../modules/auth";
import * as sanitizeHtml from 'sanitize-html';
import { URL } from 'url';
const config = require('config');
const rp = require('request-promise');

const logger = Logger.getInstance();

const entGen = TableUtilities.entityGenerator;

enum FeedbackType {
    Survey = "Survey",
    FeedbackPanel = "FeedbackPanel"
}

export const USER_SURVEYS_TABLE_NAME_PREFIX = "userSurveys";
export const PORTAL_FEEDBACKS_TABLE_NAME = "portalFeedbacks";

let keyvault: KeyVault;

export async function init(kv: KeyVault) {
    emails.init(config.get('smtp.server'), config.get('smtp.port'), config.get('smtp.user_name'), (await kv.getSecret(config.get('smtp.password_keyvault_key'))));
    keyvault = kv;
}

export async function sendFeedback(feedback: any, tenantId: string, userMail: string, userRole: number) {
    const panelFeedbackObj = {
        PartitionKey: tenantId,
        RowKey: uuid.v4(),
        email: userMail,
        userRole: auth.UserRole[`${userRole}`],
        type: FeedbackType.FeedbackPanel,
        canEmail: Boolean(sanitizeHtml(feedback.includeEmail)),
        satisfactionScore: sanitizeHtml(feedback.feedbackScore),
        text: sanitizeHtml(feedback.feedbackText)
    };
    const feedbackToInsert = getPortalFeedbackToUpdate(panelFeedbackObj);
    await tenantCosmosTableService.insertOrReplaceEntity(PORTAL_FEEDBACKS_TABLE_NAME, feedbackToInsert);
}

export async function sendSurvey(survey: any, tenantId: string, email: string, userRole: number, userId: string): Promise<void> {
    const portalFeedbackObj = {
        PartitionKey: tenantId,
        RowKey: uuid.v4(),
        email,
        userRole: auth.UserRole[userRole],
        surveyId: survey.id,
        type: FeedbackType.Survey,
        canEmail: survey.canEmail,
        nps: survey.nps,
        ces: survey.ces,
        cva: survey.cva,
        text: survey.text,
    };
    const feedbackToInsert = getPortalFeedbackToUpdate(portalFeedbackObj);
    await tenantCosmosTableService.insertOrReplaceEntity(PORTAL_FEEDBACKS_TABLE_NAME, feedbackToInsert);
    if (survey.nps || survey.text) {
        await sendFeedbackToDTP(userId, tenantId, survey);
    }
}

async function sendFeedbackToDTP(userId: string, tenantId: string, survey: any): Promise<any> {
    try {
        const token = await getDTPToken();
        const endpoint = config.get('hbs-nps.endpoint');
        const reqBody: any = {
            TenantId: tenantId,
            PageNumber: 1,
            Culture: "en-us",
            UrlReferrer: "",
            DeviceType: "Web",
            ProductContext: [
                {
                    key: "version",
                    value: "1.0"
                }
            ],
            IsDismissed: false,
            Feedbacks: []
        };

        if (survey.nps) {
            reqBody.Feedbacks.push({
                key: "rating",
                value: survey.nps
            });
        }

        if (survey.text) {
            reqBody.Feedbacks.push({
                key: "comment",
                value: survey.text
            });
        }

        const nodeEnv = process.env.NODE_ENV;
        if (nodeEnv) {
            reqBody.Geo = nodeEnv;
        }
        const reqUrl = new URL(`/api/v1/AzureHealthBot/Surveys/azurehealthbot-nps/Feedbacks?userId=${userId}`, endpoint);
        const reqOptions = {
            uri: reqUrl.href,
            method: 'post',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            json: true,
            body: reqBody,
        };
        const res = await rp(reqOptions);
        logger.info(null, `sendFeedbackToDTP successful, feedback id - ${res.FeedbackId}`);
    }
    catch (error) 
    {
        logger.error(null, `exception in sendFeedbackToDTP ${error}`);
    }
}

async function getDTPToken(): Promise<string> {
    try {
        const tokenObj = {
            grant_type: 'client_credentials',
            client_id: config.get('hbs-nps.clientId'),
            client_secret: (await keyvault.getSecret('hbs-nps-clientSecret')),
            scope: config.get('hbs-nps.scope')
        };

        const options = {
            uri: `https://login.microsoftonline.com/organizations/oauth2/v2.0/token`,
            method: 'post',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            formData: tokenObj,
            json: true
        };
        const tokenResponse = await rp(options);
        logger.info(null, `getDTPToken successful`);
        return tokenResponse.access_token;
    }
    catch (error) {
        logger.error(null, `exception in getDTPToken ${error}`);
    }
}

export async function getUserSurveyIdAsync(tenant: any, userEmail: string): Promise<string> {
    try {
        // verify sufficient data to check surveys
        if (tenant && userEmail) {
            const userSurveyRecord = await getDBUserSurvey(tenant, userEmail);
            // record exists we check if we want to show a survey
            if (userSurveyRecord) {
                const surveysConfig: any = config.getConfigSources()[0].parsed.surveys; // hack to read json object
                const userFirstLogin = new Date(userSurveyRecord.firstLogin);
                // iterate surveys in config
                for (const surveyId in surveysConfig) {
                    if (surveyId) {
                        const surveyConfig = surveysConfig[surveyId];
                        let currSurvey: Survey = null;
                        // get specific survey info for user
                        if (surveyId === TENANT_SATISFACTION_SURVEY_ID) {
                            currSurvey = JSON.parse(userSurveyRecord.tenantSatisfaction);
                        }
                        // verify not answered / declined / passed number of asked questions
                        if (currSurvey && currSurvey.status === SurveyStatus.Initial && currSurvey.askedCount < surveyConfig.intervals.length) {
                            const interval = surveyConfig.intervals[currSurvey.askedCount];
                            const now = new Date();
                            const dateBeforeInterval = new Date(now.getFullYear(), now.getMonth(), now.getDate() - interval);
                            // we are after the interval window
                            if (dateBeforeInterval > userFirstLogin) {
                                return surveyId;
                            }
                        }
                    }
                }
            } else { // no record for userSurvey in db, we insert initial record
                await initializeUserSurveyData(tenant, userEmail);
            }
        }
    } catch (error) {
        logger.error(null, `exception in getUserSurveyId ${error}`);
    }
    return null;
}

export async function updateUserSurveyData(tenant: any, email: string, status: SurveyStatus = null, increaseAskedCount = false): Promise<any> {
    const userSurveysTenantTableName = getUserSurveysTenantTableName(tenant);
    const dbUserSurvey = await getDBUserSurvey(tenant, email);
    let surveyObj: Survey = null;
    surveyObj = JSON.parse(dbUserSurvey.tenantSatisfaction);
    if (status != null) {
        surveyObj.status = status;
    }
    if (increaseAskedCount) {
        surveyObj.askedCount++;
    }
    dbUserSurvey.tenantSatisfaction = JSON.stringify(surveyObj);
    const userSurveyToUpdate = getUserSurveyToUpdate(dbUserSurvey);
    await tenantStorageTableService.insertOrReplaceEntity(userSurveysTenantTableName, userSurveyToUpdate);
}

async function getDBUserSurvey(tenant: any, email: string): Promise<any> {
    const userSurveysTenantTableName = getUserSurveysTenantTableName(tenant);
    await tenantStorageTableService.createTableIfNotExists(userSurveysTenantTableName);
    const query = new TableQuery().where('PartitionKey eq ? and RowKey eq ?', email, email);
    const userSurveyRecords = await tenantStorageTableService.queryEntities(userSurveysTenantTableName, query, null);
    if (!userSurveyRecords || userSurveyRecords.length === 0) {
        return null;
    }
    return userSurveyRecords[0];
}

export async function initializeUserSurveyData(tenant: any, email: string): Promise<any> {
    const userSurveysTenantTableName = getUserSurveysTenantTableName(tenant);
    const userSurveyObj = {
        PartitionKey: email,
        RowKey: email,
        firstLogin: new Date(),
        tenantSatisfaction: JSON.stringify(InitialSurveyData),
    };
    const userSurveyToUpdate = getUserSurveyToUpdate(userSurveyObj);
    await tenantStorageTableService.insertOrReplaceEntity(userSurveysTenantTableName, userSurveyToUpdate);
}

export async function getAll(filter = ''): Promise<any> {

    const query = new TableQuery();

    let continuationToken = null;
    const feedbacks = [];
    logger.debug(null, "reading all feedbacks...");
    do {
        const response = await tenantCosmosTableService.queryEntitiesWithContinuationToken(PORTAL_FEEDBACKS_TABLE_NAME, query, continuationToken);
        continuationToken = response.continuationToken;
        for (const item of response.value) {
            feedbacks.push(item);
        }
    } while (continuationToken);

    return feedbacks;
}

function getUserSurveyToUpdate(userSurveyObject): any {
    const userSurvey = {
        PartitionKey: entGen.String(userSurveyObject.PartitionKey),
        RowKey: entGen.String(userSurveyObject.RowKey),
        firstLogin: entGen.DateTime(userSurveyObject.firstLogin),
        tenantSatisfaction: entGen.String(userSurveyObject.tenantSatisfaction),
    };
    return userSurvey;
}

function getPortalFeedbackToUpdate(portalFeedbackObject): any {
    const userSurvey = {
        PartitionKey: entGen.String(portalFeedbackObject.PartitionKey),
        RowKey: entGen.String(portalFeedbackObject.RowKey),
        email: entGen.String(portalFeedbackObject.email),
        userRole: entGen.String(portalFeedbackObject.userRole),
        type: entGen.String(portalFeedbackObject.type),
        canEmail: entGen.String(portalFeedbackObject.canEmail),
        surveyId: entGen.String(portalFeedbackObject.surveyId),
        nps: entGen.String(portalFeedbackObject.nps),
        ces: entGen.String(portalFeedbackObject.ces),
        cva: entGen.String(portalFeedbackObject.cva),
        text: entGen.String(portalFeedbackObject.text),
        satisfactionScore: entGen.String(portalFeedbackObject.satisfactionScore),
    };
    return userSurvey;
}

function getUserSurveysTenantTableName(tenant: any): string {
    return HealthBotUtils.getTenantGeneralTableName(USER_SURVEYS_TABLE_NAME_PREFIX, tenant, 19);
}
