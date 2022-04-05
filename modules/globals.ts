import { TenantContentClient } from "healthbotcommon/tenantcontent";
import { IAccount } from "../definitions/Request/Account";

export const tenants: Record<string, IAccount> = {};
export const tenantContents: Record<string, TenantContentClient> = {};
export const evaluations = {};
