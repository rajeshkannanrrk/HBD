import { UploadedFile } from 'express-fileupload';
import {Logger} from 'healthbotcommon/logger';
const logger = Logger.getInstance();
import * as mainModel from "../main.model";
const uuid = require('node-uuid');
const azure = require('azure-storage');

enum TemplateFileTypes {
    Icon = "catalog-icons",
    Info_image = "catalog-info-img",
    Source_image = "catalog-source-img",
    TemplateContent = "catalog-templates"
}

export async function editOrAddTemplate(templateToEdit, icon, infoImg, sourceImg, templateContent){
    const add = !templateToEdit.rk;
    const dataToUpdate = {
        PartitionKey: templateToEdit.pk,
        RowKey : add ? uuid.v4() : templateToEdit.rk,
        Name: templateToEdit.name,
        Category: templateToEdit.category,
        PublishedAt: templateToEdit.publishedAt,
        Description: templateToEdit.description,
        MoreInformation: templateToEdit.more_information,
        ExtraData: templateToEdit.extra_data,
        CustomFields: templateToEdit.custom_fields,
        New: templateToEdit.new,
        UsingSourceImage: templateToEdit.usingSourceImage,
        Status: templateToEdit.status
    };

    const templateId = getTemplateId(dataToUpdate.PartitionKey, dataToUpdate.RowKey);
    try {
        await mainModel.globalCosmosTableService.insertOrReplaceEntity('templateCatalog', dataToUpdate);
        logger.debug (null, `Template successfully ${add ? "added" : "edited"}: ${templateId}`);
        const updatePromises = [];
        if (icon) {
            updatePromises.push(updateFile(TemplateFileTypes.Icon, icon, templateId));
        }
        if (infoImg) {
            updatePromises.push(updateFile(TemplateFileTypes.Info_image, infoImg, templateId));
        }
        if (sourceImg) {
            updatePromises.push(updateFile(TemplateFileTypes.Source_image, sourceImg, templateId));
        }
        if (templateContent) {
            updatePromises.push(updateFile(TemplateFileTypes.TemplateContent, templateContent, templateId));
        }
        await Promise.all(updatePromises);
    }
    catch (err) {
        throw new Error(`Failed to ${add ? "add" : "edit"} catalog template: ${templateId}, ${err}`);
    }
}

export function getTemplateId(pk: string, rk: string): string {
    return `${pk}/${rk}`;
}

export async function doesTemplateFileExist(templateId: string): Promise<boolean> {
    return mainModel.globalBlobService.doesBlobExist(TemplateFileTypes.TemplateContent, templateId);
}

async function updateFile(mediaType: string, filedata: UploadedFile, templateId: string) {
    try {
        await mainModel.globalBlobService.createBlockBlobFromLocalFile(mediaType, templateId, filedata.tempFilePath);
        logger.debug(null, "done upload");
    }
    catch (err) {
        throw new Error(`Failed to update ${mediaType} for template: ${templateId}, ${err}`);
    }
}

// *********************************************************************
// Catalog server credit managment

const catalogServerFunctions = ["providerlookup", "fileaclaim"];
const defaultNumberOfCallsAllowed = 100;

// For migration needs
export async function createCreditTable() {
    const tenants = await getTenantsIdsWithConstantPrefix();
    for (const catalogServerFunction of catalogServerFunctions) {
        const entity = extend({
            PartitionKey: uuid.v4(),
            RowKey: catalogServerFunction},
        tenants);
        try {
            await mainModel.tenantCosmosTableService.insertOrReplaceEntity("catalogServerCredits", entity);
        }
        catch (err) {
            logger.error(null, "create credit table failed " + err);
        }
    }
}

async function getTenantsIdsWithConstantPrefix() {
    const ids = {};
    const tenants = await getAllTenants();
    for (const tenant of tenants) {
        const key = "t" + tenant.RowKey.split("-").join("");
        ids[key] = defaultNumberOfCallsAllowed;
    }
    return ids;
}

async function getAllTenants(){
    let continuationToken = null;
    const tenants = [];
    logger.debug(null, "reading tenants from storage");
    do {
        const response = await mainModel.tenantCosmosTableService.queryEntitiesWithContinuationToken('tenants', new azure.TableQuery(), continuationToken);
        continuationToken = response.continuationToken;
        for (const item of response.value) {
            tenants.push(item);
        }
    } while (continuationToken);
    return tenants;
}

function extend(toObject, fromObject) {
    Object.keys(fromObject).forEach((key) => { toObject[key] = fromObject[key]; });
    return toObject;
}
