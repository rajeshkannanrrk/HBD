var stars = "\n********************************************************************\n";
var expect = require('chai').expect;
var sinon = require('sinon');
var config = require('config');
import {Logger} from 'healthbotcommon/logger';
var logger = Logger.getInstance();

// Loading and setting relevant dependencies-mocks
// -----------------------------------------------------------

// Loading SUT
// -----------------------------------------------------------
import * as model from "../models/admin-portal-v3/scenarios/scenarios.search.model";
import * as mainModel from "../models/admin-portal-v3/main.model";

// Test packages definitions
// -----------------------------------------------------------
describe(stars + "HealthBotDashboard > Models > Scenarios > Search" + stars, () => {
    it('TODO');
});
