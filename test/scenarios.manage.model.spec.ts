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
import * as model from "../models/admin-portal-v3/scenarios/scenarios.manage.model";
import * as mainModel from "../models/admin-portal-v3/main.model";

// Test packages definitions
// -----------------------------------------------------------
describe(stars + "HealthBotDashboard > Models > Scenarios > Manage" + stars, () => {
    it('importFromJson');
    it('getExportJson');
    it('getAllAccountScenarios');
    it('getBeginableBuiltinScenarios');
    it('validateScenarioScheme');
    it('validateAPIimport');
    it('validateImportScenarios');
    it('scenarioFilesToObjects');
    it('scenarioStringToObject');
    it('validateImportScenarios');
    it('validateScenario');
    it('loadScenarioCode');
    it('oldSaveScenario');
    it('deleteScenario');
    it('getScenarios');
    it('activateScenario');
    it('archiveAndSendScenarios');
    it('getSearchApiKey');
    describe('privateFunctions', () => {
        it('getScenarioIdByName', () => {
            const scenarios = [];
            for (let i = 1; i <= 5; i ++) {
                scenarios.push({name: "s" + i, RowKey: "r" + i});
            }
            expect(model.getScenarioIdByName("s1", scenarios)).to.be.equal("r1");
            expect(model.getScenarioIdByName("s4", scenarios)).to.be.equal("r4");
            expect(model.getScenarioIdByName("s6", scenarios)).to.be.equal("");
            expect(model.getScenarioIdByName(null, scenarios)).to.be.equal("");
        });
    });
});
