const stars = "\n********************************************************************\n";
const expect = require('chai').expect;
const sinon = require('sinon');
const config = require('config');
import {Logger} from 'healthbotcommon/logger';
const logger = Logger.getInstance();

// Loading and setting relevant dependencies-mocks
// -----------------------------------------------------------

// Loading SUT
// -----------------------------------------------------------
import * as skillsModel from "../models/admin-portal-v3/integration/integration.skills.model";
import * as mainModel from "../models/admin-portal-v3/main.model";

// Test packages definitions
// -----------------------------------------------------------
describe(stars + "HealthBotDashboard > Models > Integration > Skills" + stars, () => {
    it('getSkills');
    it('saveSkill');
    it('deleteSkill');
});
