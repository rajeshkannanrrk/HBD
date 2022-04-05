
import * as util from 'util';
import * as config from 'config';
import * as mainModel from "../main.model";
import { tenantContents, tenants } from "../../../modules/globals";
import { logSkillsChange } from "../../../services/auditTrailsLogger";

interface IAuthorizedAppId {
    appId: string;
    description: string;
}

export interface ISkillExposureConfig {
    name: string;
    description: string;
    publisherName: string;
    authorizedAppIds: IAuthorizedAppId[];
    isExposed: boolean;
    isRestricted: boolean;
}

const varToTenantConfigMap = {
    name: "name",
    description: "description",
    publisherName: "publisher_name",
    authorizedAppIds: "authorized_app_ids",
    isExposed: "is_exposed",
    isRestricted: "is_restricted"
};

/**
 * Reset the skills exposure config only to default - Expsoure: off, Restricted: on, name: botFriendlyName. Others are empty values.
 *
 * @param account - The tenant for which we want to reset the skill exposure config.
 * @param editor - The user who performed the action (for audit trails).
 * @return - Promise<void> - Resolved after reset is performed
 */
export async function resetSkillExposureConfig(account: any, editor: string): Promise<void> {
    await saveSkillConfiguration(account, {authorizedAppIds: [], isExposed: false, isRestricted: true, name: account.friendly_name, description: "", publisherName: ""}, editor, true);
}

/**
 * Updates the value of skills attribute in tenant config, and send reloadTenant event to bots.
 *
 * @param account - The account of the tenant.
 * @param skillConfig - An object holding the relevant changes in the Skill config.
 * @param editor - The user who performed the edit.
 * @param skipValidation - Allow missing attributes for resetting configuration.
 * @return Promise<void> - A promise that is resolved when update process is complete.
 */
export async function saveSkillConfiguration(account: any, skillConfig: Partial<ISkillExposureConfig>, editor: string, skipValidation?: boolean): Promise<void> {
    const tenantConfig = await tenantContents[account.name].config.getOverrides(); // Extract tenant data from globals.

    if (!skipValidation) {
        const appIDPattern = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');
        const allAppIds: string[] = [];
        for (const entry of skillConfig.authorizedAppIds || []) {
            allAppIds.push(entry.appId);
        }
        // Validate name and publisher name are not missing
        if (!skillConfig.name) { // skillConfig.name can be empty only when tenant already has a skill name.
            throw new Error(`Missing Name`);
        }
        if (!skillConfig.publisherName) { // skillConfig.publisherName can be empty only when tenant already has a publisher name.
            throw new Error(`Missing Publisher Name`);
        }
        // Validate app ids - No repetitions, no empty app ids and app id has a well defined format.
        const repeatsCounter: {[appId: string]: number} = {};
        allAppIds.forEach((x) => {
            repeatsCounter[x] = (repeatsCounter[x] || 0) + 1;
        });
        const duplicates: string[] = Object.keys(repeatsCounter).filter((key) => repeatsCounter[key] > 1);
        if (duplicates.length > 0) {
            throw new Error(`Duplicate App id ${duplicates.join(', ')}`);
        }
        for (const appId of allAppIds) {
            if (!appId) {
                throw new Error('Empty bot id');
            }
            else if (!appIDPattern.test(appId)) {
                throw new Error(`${appId} is not a valid App ID`);
            }
        }
    }
    // Update tenant config and update audit trails
    if (!tenantConfig.skills) {
        tenantConfig.skills = {};
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const noOp = () => {};
    const hasChanged = (attribute) => !util.isDeepStrictEqual(tenantConfig.skills[varToTenantConfigMap[attribute]], skillConfig[attribute]);
    const changes = [
        ['isExposed'].some(hasChanged) ? () => logSkillsChange(account.name, "exposed", editor, {value: skillConfig.isExposed ? "on" : "off" }) : noOp,
        ['authorizedAppIds', 'isRestricted'].some(hasChanged) ? () => logSkillsChange(account.name, "modified", editor, {section: "Skill Consumers" }) : noOp,
        ['name', 'description', 'publisherName'].some(hasChanged) ? () => logSkillsChange(account.name, "modified", editor, {section: "Skill Properties" }) : noOp
    ];
    for (const [attribute, value] of Object.entries(skillConfig)) { // Update tenant config for each supplied attribute, and collect changes for audit trails.
        tenantConfig.skills[varToTenantConfigMap[attribute]] = value; // Update tenant config object.
    }
    await tenantContents[account.name].config.save(tenantConfig);
    mainModel.reloadTenant(account.name);
    changes.forEach((logChangeFunction) => logChangeFunction());
}

/**
 * Returns the ISkillConfig of the given tenant account.
 *
 * @param account - The tenant account for which we want to get the ISkillConfig object.
 * @return - A promise resolved by the ISkillConfig object of the given tenant account.
 */
export async function getSkillExposureConfiguration(account: any): Promise<ISkillExposureConfig> {
    const tenantConfig = await tenantContents[account.name].config.load();

    return {
        name: tenantConfig.get("skills")[varToTenantConfigMap.name] ?? account.friendly_name ?? account.name,
        description: tenantConfig.get("skills")[varToTenantConfigMap.description],
        publisherName: tenantConfig.get("skills")[varToTenantConfigMap.publisherName],
        isExposed: tenantConfig.get("skills")[varToTenantConfigMap.isExposed],
        isRestricted: tenantConfig.get("skills")[varToTenantConfigMap.isRestricted],
        authorizedAppIds: tenantConfig.get("skills")[varToTenantConfigMap.authorizedAppIds]
    };
}

/**
 * Returns the IManifestResponse object of the given tenant account.
 *
 * @param account - The tenant account for which we want to get the manifest object.
 * @return - string - Skill Manifest Url.
 */
export function getSkillManifestUrl(account: any): string {
    const tenantData = tenants[account.name];
    return `${config.get('bot.url')}/dynabot/${tenantData.name}/skill/manifest`;
}

export const privateFunctions = {};
