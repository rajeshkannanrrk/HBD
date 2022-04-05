import { LocalizationObject } from "healthbotcommon/tenantcontent";
import { defaultLocalizationClient, mergeLocalizationObjects } from "healthbotcommon/tenantcontent/localization";
import { tenantContents } from "../../../modules/globals";
import { getStringId } from "../language-models/configuration.localization.model";
import {
    cleanUndefinedFields,
    getValueByPath,
    setValueByPath
} from "./configuration.common.model";
import * as mainModel from "../main.model";
import { logNewConfigurationChange, logLocalizationChange } from "../../../services/auditTrailsLogger";

async function empty(configData) {
    // do nothing
}


export class ConfigurationPageModel {
    private name = "";
    private map = {};
    private customValidator: (updatedData: any, assert: (condition: boolean, msg: string) => void) => void;
    private afterRead: (account, configData) => Promise<void>;
    private beforeSave: (configData) => Promise<void>;

    public constructor(name: string, mapping: Record<string, any>, customValidator: (updatedData: any, assert: (condition: boolean, msg: string) => void) => void, afterRead: (account, configData) => Promise<void> = empty, beforeSave: (configData) => Promise<void> = empty) {
        this.name = name;
        this.map = mappingToMap(mapping);
        this.customValidator = customValidator;
        this.afterRead = afterRead;
        this.beforeSave = beforeSave;
    }

    public async read(account, isSysAdmin: boolean) {
        const defaultLocalizedStrings = defaultLocalizationClient.get();
        const [tenant, schema, { isLocalizationEnabled }, systemLocalizedStrings] = await Promise.all([
            tenantContents[account.name].config.getOverrides(),
            tenantContents[account.name].config.getSchema(),
            tenantContents[account.name].config.load().then((tenantConfig) => tenantConfig.get("localizationSettings")),
            tenantContents[account.name].localization.system.get()
        ]);

        const mergedLocalizedStrings = mergeLocalizationObjects(defaultLocalizedStrings, systemLocalizedStrings);

        await this.afterRead(account, schema);
        const configData = {};

        for (const [newPath, oldPath] of Object.entries(this.map)) {
            let schemeValue = getValueByPath(schema, oldPath);
            let tenantValue = getValueByPath(tenant, oldPath);
            const isDefaultValue = (tenantValue === undefined || tenantValue === null);
            tenantValue = isDefaultValue ? schemeValue.default : tenantValue;

            // this test verifies that the requested field is well defined.
            if (!schemeValue.hasOwnProperty("_convict_tenant_can_edit")) {
                throw new Error(`missing definition for ${oldPath}`);
            }

            // this test masks sys admin fields so that tenants won't even get the data to the client side
            if (!isSysAdmin && !schemeValue._convict_tenant_can_edit) {
                continue;
            }

            schemeValue = schemeValue.format === "Array" ? {
                itemType: schemeValue._convict_itemType,
                default: schemeValue.default,
                format: schemeValue.format
            } : {
                default: schemeValue.default,
                format: schemeValue.format
            };

            // if the value is 'LocalizedString', replace the ids with the string object
            if (schemeValue.format === "LocalizedString") {
                schemeValue.default = getDefaultSystemStringObject(schemeValue.default, defaultLocalizedStrings);
                tenantValue = isDefaultValue ? schemeValue.default : getDefaultSystemStringObject(tenantValue, mergedLocalizedStrings);
            }
            else if (schemeValue.format === "Array") {
                if (schemeValue.itemType === "LocalizedString") {
                    schemeValue.default = schemeValue.default.map((stringId) => getDefaultSystemStringObject(stringId, defaultLocalizedStrings));
                    tenantValue = isDefaultValue ? schemeValue.default : tenantValue.map((stringId) => getDefaultSystemStringObject(stringId, mergedLocalizedStrings));
                }
                else if (typeof(schemeValue.itemType) === "object") {
                    const keysAndTypes: Array<[string, string]> = Object.entries(schemeValue.itemType);
                    for (const [key, typeName] of keysAndTypes) {
                        if (typeName === "LocalizedString") {
                            schemeValue.default.forEach((item) => item[key] = getDefaultSystemStringObject(item[key], defaultLocalizedStrings));
                            if (!isDefaultValue) {
                                tenantValue.forEach((item) => item[key] = getDefaultSystemStringObject(item[key], mergedLocalizedStrings));
                            }
                        }
                        tenantValue = isDefaultValue ? schemeValue.default : tenantValue;
                    }
                }
            }

            setValueByPath(configData, newPath, {
                _scheme: schemeValue,
                _tenant: tenantValue,
                _default: isDefaultValue
            });
        }
        return {configData, isLocalizationEnabled};
    }

    public async saveData(account: any, updatedData: any, isSysAdmin: boolean, editor: any) {
        await this.beforeSave(updatedData);

        const [tenant, schema, systemLocalizedStrings] = await Promise.all([
            tenantContents[account.name].config.getOverrides(),
            tenantContents[account.name].config.getSchema(),
            tenantContents[account.name].localization.system.get()
        ]);

        const localizedStrings = mergeLocalizationObjects(defaultLocalizationClient.get(), systemLocalizedStrings);

        // validate that the updated data is aligned to scheme and corresponds with specific tests
        this.validate(updatedData, schema);
        updatedData = updatedData !== null ? updatedData : {};

        // create a list of new localization strings to create.
        // this code is relevant only for tenants that not turned localization on.
        const localizedStringsToUpdate = [];

        // creating the updated tenant specific object
        const paths: Array<[string, string]> = Object.entries(this.map);
        for (const [newPath, oldPath] of paths) {

            // skip this value set if the editor is not sys admin and the value is sys admin only
            const isSysAdminField = !getValueByPath(schema, oldPath)._convict_tenant_can_edit;
            if (!isSysAdmin && isSysAdminField) {
                continue;
            }

            // getting new value for current setting
            let newValue = getValueByPath(updatedData, newPath);

            // if the value is not in the object, it is deleted. setting it to 'undefined'
            if ((newValue === undefined) || (newValue === null)) {
                setValueByPath(tenant, oldPath, undefined);
                continue;
            }

            // read value format and default from scheme
            const format = getValueByPath(schema, oldPath).format;
            const defaultValue = getValueByPath(schema, oldPath).default;

            // for localized strings, if the does not contain string id, create one based
            if (format === "LocalizedString") {
                newValue = processLocalizedString(newValue, defaultValue, localizedStrings, localizedStringsToUpdate);
            }
            else if (format === "Array") {
                const itemType = getValueByPath(schema, oldPath)._convict_itemType;
                if (itemType === 'LocalizedString') {
                    newValue = newValue.map((item) => processLocalizedString(item, oldPath, localizedStrings, localizedStringsToUpdate));
                }
                else if (typeof(itemType) === 'object') {
                    const keysAndTypes: Array<[string, string]> = Object.entries(itemType);
                    for (const [key, typeName] of keysAndTypes) {
                        if (typeName === 'LocalizedString') {
                            for (const item of newValue) {
                                item[key] = processLocalizedString(item[key], oldPath, localizedStrings, localizedStringsToUpdate);
                            }
                        }
                    }
                }
            }

            // set the new value to the tenantSpecific
            setValueByPath(tenant, oldPath, newValue);
        }

        // clean the undefined (deleted) fields from the updated tenant specific
        cleanUndefinedFields(tenant);

        // officially add the new localized strings to the tenant system localization.
        // this code is relevant only for tenants that not turned localization on.
        if (localizedStringsToUpdate.length > 0) {
            await tenantContents[account.name].localization.system.saveChanges(localizedStringsToUpdate);
            mainModel.reloadTenant(account.name);
            logLocalizationChange(account.name, "modified", editor.emails[0].value, "system");
        }

        // save the updated tenant specific json object to storage
        await tenantContents[account.name].config.save(tenant);
        mainModel.reloadTenant(account.name);

        // log configuration change for this page under audit trails
        logNewConfigurationChange(account.name, editor.emails[0].value, this.name);
    }

    private validate(updatedData, scheme) {
        // if we are in a reset flow, validation is not needed.
        if (updatedData === null) {
            return;
        }
        for (const [newPath, oldPath] of Object.entries(this.map)) {
            const valueDefinition = getValueByPath(scheme, oldPath);
            let format = valueDefinition.format;
            const newValue = getValueByPath(updatedData, newPath);

            // if the value is null or undefined then it is a deleted value
            if (newValue === undefined || newValue === null) {
                continue;
            }

            // if the format is array (enum), just make sure that the value match one of the options
            if (Array.isArray(format)) {
                assert(format.indexOf(newValue) !== -1);
                continue;
            }

            // if the value is localized string, make sure it is of the correct structure
            format = format.toLowerCase();
            if (format === "localizedstring") {
                assert(typeof (newValue) === "object");
                assert(newValue.hasOwnProperty("stringId"));
                assert(newValue.hasOwnProperty("en-us"));
                assert(Object.keys(newValue).length === 2);
                continue;
            }

            // if the value is primitive string, boolean or number
            if ((format === "string") || (format === "boolean") || (format === "number")) {
                assert(typeof (newValue) === format);
                continue;
            }

            // if the value is url the type should be string
            if ((format === "url")) {
                assert(typeof (newValue) === "string");
                continue;
            }

            // if the value is natural number
            if (format === "nat") {
                assert(isNaturalNumber(newValue));
                continue;
            }

            // if the value is an array of items
            if (format === "array") {
                assert(Array.isArray(newValue));
                const itemType: any = valueDefinition._convict_itemType;

                // verify items are valid
                for (const item of newValue) {
                    // if array of primitives, verify type of all items
                    if (typeof (itemType) === 'string') {
                        switch (itemType.toLowerCase()) {
                            case "string":
                            case "boolean":
                            case "number":
                                assert(typeof (item) === itemType);
                                break;
                            case "nat":
                                assert(isNaturalNumber(item));
                                break;
                            case "localizedstring":
                                // TODO: add this once we will need..
                                assert(false);
                                break;
                        }
                        continue;
                    }

                    // if array of objects, verify all items are from a valid structure
                    if (typeof (itemType) === "object") {
                        // make sure that item is an object
                        assert(typeof (item) === 'object');

                        // make sure no additional fields are set
                        for (const [key, t] of Object.entries(item)) {
                            assert(itemType.hasOwnProperty(key));
                        }

                        // make sure all required fields are set and from the correct type
                        const entries: Array<[string, string]> = Object.entries(itemType);
                        // eslint-disable-next-line prefer-const
                        for (let [key, typeName] of entries) {
                            assert(item.hasOwnProperty(key));
                            typeName = typeName.toLowerCase();
                            switch (typeName) {
                                case "string":
                                case "boolean":
                                case "number":
                                    assert(typeof(item[key]) === typeName);
                                    break;
                                case "nat":
                                    assert(isNaturalNumber(item[key]));
                                    break;
                                case "localizedstring":
                                    assert(item[key].hasOwnProperty("stringId"));
                                    assert(item[key].hasOwnProperty("en-us"));
                                    assert(Object.keys(item[key]).length === 2);
                                    break;
                                default:
                                    // arriving here means something is not defined correctly in tenant.json
                                    assert(false);
                                    break;
                            }
                        }
                        continue;
                    }
                    // arriving here means something is not defined correctly in tenant.json
                    assert(false);
                }
                continue;
            }

            // arriving here means something is not defined correctly in tenant.json
            assert(false);

        }
        this.customValidator(updatedData, assert);
    }
}

function getDefaultSystemStringObject(stringId, localizedStrings: LocalizationObject) {
    const translation = localizedStrings["en-us"][stringId];

    return translation ?
        { stringId, "en-us": translation } :
        { "stringId": null, "en-us": stringId };
}

function mappingToMap(mapping, currentPath = [], map = {}) {
    for (const key of Object.keys(mapping)) {
        currentPath.push(key);
        if (typeof mapping[key] === 'string') {
            map[currentPath.join(".")] = mapping[key];
        }
        else {
            mappingToMap(mapping[key], currentPath, map);
        }
        currentPath.pop();
    }
    return map;
}

function assert(condition: boolean, message = "Data is not complying with scheme") {
    if (!condition) {
        // eslint-disable-next-line no-throw-literal
        throw {
            message,
            statusCode: 422
        };
    }
}

function isNaturalNumber(n) {
    return (typeof (n) === 'number') && (n >= 0.0) && (Math.floor(n) === n) && (n !== Infinity);
}

function processLocalizedString(newValue: { stringId: string; "en-us": string }, defaultValue: string, localizedStrings: LocalizationObject, localizedStringsToUpdate) {
    const existingValue = getDefaultSystemStringObject(newValue.stringId, localizedStrings)["en-us"];

    if (!newValue.stringId || (newValue.stringId === defaultValue && newValue['en-us'] !== existingValue)) {
        newValue.stringId = getStringId(newValue["en-us"], defaultValue);
        localizedStringsToUpdate.push(newValue);
    }
    else {
        // checking if existing id was changed or not.
        if (existingValue !== newValue['en-us']) {
            localizedStringsToUpdate.push(newValue);
        }
    }

    return newValue.stringId;
}
