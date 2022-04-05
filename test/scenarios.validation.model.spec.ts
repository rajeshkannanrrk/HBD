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
import * as model from "../models/admin-portal-v3/scenarios/scenarios.validation.model";
import * as mainModel from "../models/admin-portal-v3/main.model";

// Test packages definitions
// -----------------------------------------------------------
describe(stars + "HealthBotDashboard > Models > Scenarios > Validation" + stars, () => {
    it('validateScenarioId', () => {
        expect(model.validateScenarioId('invalid scenario')).to.be.false;
        expect(model.validateScenarioId('invalid-scenario')).to.be.false;
        expect(model.validateScenarioId('inv@lid_scenario')).to.be.false;
        expect(model.validateScenarioId('valid_scenario')).to.be.true;
        expect(model.validateScenarioId('valid_scenari0')).to.be.true;
        expect(model.validateScenarioId('/valid')).to.be.true;
        expect(model.validateScenarioId('\\valid')).to.be.true;
        expect(model.validateScenarioId('\\/_')).to.be.true;
    });
});
