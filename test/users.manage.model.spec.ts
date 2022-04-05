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
import * as usersModel from "../models/admin-portal-v3/users/users.manage.model";

// Test packages definitions
// -----------------------------------------------------------
describe(stars + "HealthBotDashboard > Models > Users > Manage" + stars, () => {
    it('addUser');
    it('deleteUser');
    it('updateUserRole');
    it('deleteUsers');
    it('getUserTenants');
});
