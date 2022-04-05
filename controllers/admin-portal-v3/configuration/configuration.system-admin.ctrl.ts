import { configurationSystemAdminModel } from "../../../models/admin-portal-v3/configuration/configuration.system-admin.model";

import { createRouter } from "./configuration.page.ctrl";

export const router = createRouter("system-admin", "admin-portal-v3/configuration/configuration.system-admin.ejs", configurationSystemAdminModel);
