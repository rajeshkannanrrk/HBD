
import * as azure from 'azure-storage';
import * as config from 'config';
import { Logger } from 'healthbotcommon/logger';
import { BackupImageData } from '../../../definitions/backup-restore/BackupImageData';
import * as restoreModel from '../backup-restore/restore.model';
import { IKnowledgeBaseDetails, IKnowledgeBaseEndpointKeys, QnAMakerKnowledgeBase } from '../language-models/qnmaker/QnAMakerKnowledgeBase.class';
import * as mainModel from '../main.model';
import { eventTypes } from '../../../logging';

const mila = require('markdown-it-link-attributes');
const md = require('markdown-it')();
md.use(mila, {
    attrs: {
        target: '_blank',
        rel: 'noopener'
    }
});
const logger = Logger.getInstance();

interface ICatalogTemplate {
    PartitionKey: string;
    RowKey: string;
    name: string;
    scenario_trigger: string;
    Icon: string;
    Img: string;
    SourceImg: string;
    main: string;
    id: string;
    userDisplayName: string;
    updated: string;
    CustomFields: any;
    ExtraData: string;
    ExtraDataHTML: string;
}

function enrichTemplateData(templates: ICatalogTemplate[]): void {
    const iconsUrl = mainModel.globalBlobService.getUrl("catalog-icons") + "/";
    const imagesUrl = mainModel.globalBlobService.getUrl("catalog-info-img") + "/";
    const sourceImagesUrl = mainModel.globalBlobService.getUrl("catalog-source-img") + "/";
    for (const template of templates) {
        // create media urls for visual data for the catalog
        template.Icon = iconsUrl + template.PartitionKey + "/" + template.RowKey;
        template.Img = imagesUrl + template.PartitionKey + "/" + template.RowKey;
        template.SourceImg = sourceImagesUrl + template.PartitionKey + "/" + template.RowKey;

        // parsing custom fields
        template.CustomFields = template.CustomFields ? JSON.parse(template.CustomFields) : [];

        // render extra data html
        try {
            template.ExtraDataHTML = md.render(template.ExtraData.replace(/\\n/g, "\n"));
        } catch (e) {
            template.ExtraDataHTML = template.ExtraData;
        }
    }
}

export async function getTemplates() {
    let catalogTemplates;
    logger.debug(null, "Start reading catalog templates from table");
    try {
        // currently the only catalog we have is the builtin one
        // in the future we may have additional catalogs under other partition keys
        const builtinTemplateCatalogKey = config.get('azure_storage.builtin_template_catalog_key');
        const query = new azure.TableQuery().where("PartitionKey eq ?", builtinTemplateCatalogKey);
        catalogTemplates = await mainModel.globalCosmosTableService.queryEntities('templateCatalog', query, null);
    }
    catch (err) {
        throw new Error(`Failed to read catalog table. error: ${err.message}`);
    }
    logger.debug(null, "Finish reading catalog templates from table");
    enrichTemplateData(catalogTemplates);
    catalogTemplates.sort((a, b) => ((a.Status === 'Enabled' && b.Status !== 'Enabled') ? -1 : (b.Status === 'Enabled' && a.Status !== 'Enabled') ? 1 : ((new Date(b.Timestamp)).getTime() - (new Date(a.Timestamp)).getTime())));

    return catalogTemplates;
}


async function importQnAMaker(qnaKnowledgeBase: QnAMakerKnowledgeBase, kbName: string, templateContent: BackupImageData) {
    try {
        const createResponse: { details: IKnowledgeBaseDetails; endpointKeys: IKnowledgeBaseEndpointKeys } = await qnaKnowledgeBase.create(kbName);
        const languageModelName = Object.keys(templateContent.configuration.language_understanding.qna_recognizers)[0];
        templateContent.configuration.language_understanding.qna_recognizers[languageModelName].qnaEndpoint = createResponse.details.hostName;
        templateContent.configuration.language_understanding.qna_recognizers[languageModelName].kbId = createResponse.details.id;
        templateContent.configuration.language_understanding.qna_recognizers[languageModelName].subscription_key = createResponse.endpointKeys.primaryEndpointKey;
        templateContent.configuration.language_understanding.qna_recognizers[languageModelName].api_key = qnaKnowledgeBase.subscriptionKey;
    } catch (error) {
        throw new Error('an error occurred, please check your subscription key and try again in a few minutes');
    }
}
export interface CustomField  {        
    value: any,
    name: string,
    fileName?: string,
    inputType: 'Text' | 'Dropdown',
    dropdownOptions?: any,
    applicationId?: string, // used for LUIS models
}

/**
 *
 * @param templateCatalogKey : template catalog key
 * @param templateId : template id
 * @param customFields: template's customFields (from user's input)
 * @param userDisplayName: user name
 * @param account:
 * @param editor
 * @returns {Promise<any>}
 */
export async function importFromCatalog(templateId, templateCatalogKey, customFields: CustomField[], userDisplayName, account, editor) {
    let templateBlob;
    let templateDetails;
    let templateContent: BackupImageData;
    let newTemplateId: string;
    
    try {
        templateDetails = await mainModel.globalCosmosTableService.retrieveEntity("templateCatalog", templateCatalogKey, templateId);
    }
    catch (err) {
        throw new Error(`Failed to get record of template ${templateId} from catalog ${templateCatalogKey}. error: ${err.message}`);
    }
    if (templateDetails.Status !== "Enabled") {
        throw new Error ("Template is not available");
    }
    try {
        const requestOptions: azure.BlobService.BlobRequestOptions = {
            locationMode: azure.StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY
        };
        templateBlob = await  mainModel.globalBlobService.getBlobToText("catalog-templates", templateCatalogKey + "/" + templateId, requestOptions);
        templateContent = JSON.parse(templateBlob);
        // creating a new templateId field consisting catalog key, template Id and template name
        newTemplateId = `${templateCatalogKey}/${templateId}/${templateDetails.Name}`;
    }
    catch (err) {
        throw new Error(`Failed to get content of template ${templateId} from repository ${templateCatalogKey}. error: ${err.message}`);
    }

    let mainScenario;   
    if (templateContent.scenarios.length === 1) {
        mainScenario = templateContent.scenarios[0];
    } else {
        for (const scenario of templateContent.scenarios) {
            scenario.templateId = templateCatalogKey + "_" + templateId;
            scenario.userDisplayName = userDisplayName;
            if (scenario.main) {
                if (mainScenario) {
                    throw new Error('Template contains more than 1 main scenario');
                }
                mainScenario = scenario;
            }
            scenario.userDisplayName = userDisplayName;
            scenario.updated = new Date();
        }
    }
    if (!mainScenario) {
        throw new Error ('Template contains no main scenario');
    }
    let firstActionStepCode: string = mainScenario.code.steps[0].onInit;
    let qnaMakerKnowledgeBase: QnAMakerKnowledgeBase;

    if (customFields) {
        for (const field of customFields) {
            let languageModelName: string;
            switch (field.name) {
                case "QnAMaker Subscription Key":
                    qnaMakerKnowledgeBase = new QnAMakerKnowledgeBase({
                        tenant: {
                            id: account.id,
                            name: account.name,
                        },                       
                        blobURIs: [`${mainModel.globalBlobService.getUrl("public")}/${field.fileName}`],
                        subscriptionKey: field.value,
                    });
                    await importQnAMaker(qnaMakerKnowledgeBase, field.fileName.split('.tsv')[0], templateContent);
                    break;
                case 'LUIS Prediction Key':
                    languageModelName = Object.keys(templateContent.configuration.language_understanding.luis_models)[0];
                    templateContent.configuration.language_understanding.luis_models[languageModelName].application_id = field.applicationId;
                    templateContent.configuration.language_understanding.luis_models[languageModelName].subscription_key = field.value;

                    break;
                case 'Region':
                    languageModelName = Object.keys(templateContent.configuration.language_understanding.luis_models)[0];
                    templateContent.configuration.language_understanding.luis_models[languageModelName].region = field.value;

                    break;
                default:
                    // storing field as scenario variable (performed in action step)
                    // changing field name to camel case to be stored as scenario variable
                    const scenarioField = field.name
                        .replace(/\s(.)/g, ($1) => $1.toUpperCase())
                        .replace(/\s/g, '')
                        .replace(/^(.)/, ($1) => $1.toLowerCase());

                    let assignVariable: string;
                    switch (field.inputType) {
                        case 'Text':
                            assignVariable = `scenario.${scenarioField} = '${field.value}';`;
                            break;
                        case 'Dropdown':
                            const value = field.dropdownOptions.find((elem) => elem.value === field.value);
                            delete value.$$hashKey;
                            assignVariable = `scenario.${scenarioField} = ${JSON.stringify(value)};`;
                            break;
                    }

                    firstActionStepCode = `${assignVariable}\r\n${firstActionStepCode}`;
                    break;
            }
        }

        if (firstActionStepCode) {
            mainScenario.code.steps[0].onInit = firstActionStepCode;
        }
    }

    try {
        await restoreModel.restore(account, templateContent, editor, true, newTemplateId); // assigns new RowKey to each scenario in template content
        const event = {
            tenantId: account.id,
            tenantName: account.name,
            templateId,
            templateName: templateDetails.Name,
            region: config.get('azure_healthbot.resource_region')
        };

        logger.analyticsEvent(eventTypes.TEMPLATE_PROVISION, { logContext: event });
        
    } catch (error) {
        if (qnaMakerKnowledgeBase) {
            await qnaMakerKnowledgeBase.rollbackKnowledgeBase();
        }

        throw error;
    }

    return mainScenario.RowKey;
}
