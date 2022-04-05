import { createRouter } from "../configuration/configuration.page.ctrl";

import { resourcesEnvironmentVariablesModel } from "../../../models/admin-portal-v3/resources/resources.environment-variables.model";

export const router = createRouter("environment-variables", "admin-portal-v3/resources/resources.environment-variables.ejs", resourcesEnvironmentVariablesModel);
