const stars = "\n********************************************************************\n";
import { expect } from 'chai';
import * as sinon from 'sinon';
const http_mocks = require('node-mocks-http');
const globals = require('../modules/globals');

import * as mainModel from "../models/admin-portal-v3/main.model";
const router = require('../controllers/admin-portal-v3/main.ctrl').router;
import {
    mockScenarioBlob, mockBlobService,
    mocktTenantCosmosTableService, mockTenantStorageTableService
} from './mocks/data/scenarios';


describe(stars + "HealthBotDashboard > Controller > Scenarios" + stars, () => {

    before(async () => {

        const mockSendErrorToClient = (res, error) => {
            const statusCode = error.statusCode ? error.statusCode : 400;
            const message = error.message ? error.message : "an error occurred";
            res.status(statusCode).send(message);
        }

        const mockReloadTenant = () => {
        }
        const mockReloadTenantScenario = () => {
        }

        await mainModel.init(null,
            mockBlobService as any,
            mockTenantStorageTableService,
            mocktTenantCosmosTableService as any,
            null,
            null,
            null,
            null,
            { getSecret: (name) => null },
            mockReloadTenant,
            mockSendErrorToClient,
            mockReloadTenantScenario,
            null, null, null, null, null, null, null);

        globals.tenants["myaccount"] = {
            name: "myaccount",
            id: "1"
        }

        globals.tenantContents["myaccount"] = {
            auditTrails: {log: sinon.stub()},
            config: { load: sinon.stub().returns({ get: sinon.stub().returns(["/builtin/somescenario"]) }) },
        };
    })

    after(() => {
        delete globals.tenantContents["myaccount"];
    })

    // it('Get all scenarios', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'GET',
    //         url: '/scenarios/manage/all?builtin=true'
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             const data = res._getData();
    //             expect(data).to.be.of.length(2);
    //             expect(data[0].scenario_trigger).to.be.equal('/builtin/somescenario');
    //             expect(data[1].scenario_trigger).to.be.equal("trigger1");
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })
    //
    // it('Export scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'POST',
    //         url: '/scenarios/manage/export?format=native',
    //         body: {
    //             names: ['myscenario']
    //         }
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             const data = res._getData();
    //             const scenario = JSON.parse(data);
    //             const expected = mockScenarioBlob;
    //             const actually = JSON.parse(scenario.code);
    //             expect(actually).to.be.deep.equal(expected);
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })
    //
    // it('Import scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'POST',
    //         url: '/scenarios/manage/import',
    //         body: {
    //             names: ['myscenario']
    //         }
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     req.user = {
    //         displayName: "Arie"
    //     }
    //     req.userRole = 3
    //
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })
    //
    // it('Get Active state', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'GET',
    //         url: '/scenarios/manage/id/activeState',
    //         body: {
    //             names: ['myscenario']
    //         }
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             const data = res._getData();
    //             expect(data).to.be.equal("true");
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })
    //
    // it('Activate scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'POST',
    //         url: '/scenarios/manage/id/activate'
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     req.userRole = 3
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })
    //
    // it('Deactivate scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'POST',
    //         url: '/scenarios/manage/id/deactivate'
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     req.user = {
    //         displayName: "Arie",
    //         emails: ["arie@ScopedCredential.com"]
    //     }
    //
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })
    //
    // it('Delete scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'POST',
    //         url: '/scenarios/manage/delete',
    //         body: {
    //             ids: ["id"]
    //         }
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     req.user = {
    //         displayName: "Arie",
    //         emails: ["arie@ScopedCredential.com"]
    //     }
    //
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })
    //
    // it('Add scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'POST',
    //         url: '/scenarios/manage/add',
    //         body: { name: 'mynewscenario', trigger: 'mytrigger' }
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     req.userRole = 3
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     req.user = {
    //         displayName: "Arie",
    //         emails: ["arie@ScopedCredential.com"]
    //     }
    //
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             const id = res._getData();
    //             expect(id).to.be.of.a("string")
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    //
    // })
    //
    // it('Put scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'PUT',
    //         url: '/scenarios/manage/id',
    //         body: { name: 'mynewscenario', trigger: 'mytrigger' }
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     req.userRole = 3
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     req.user = {
    //         displayName: "Arie",
    //         emails: ["arie@ScopedCredential.com"]
    //     }
    //
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    //
    // })
    //
    // it('Get Cloned scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'GET',
    //         url: '/scenarios/manage/clone/id'
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     req.userRole = 3
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     req.user = {
    //         displayName: "Arie",
    //         emails: ["arie@ScopedCredential.com"]
    //     }
    //
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             const data = res._getData();
    //             expect(data.name).to.be.equal('myscenario_copy');
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    //
    // })
    //
    // it('Create Cloned scenario', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'POST',
    //         url: '/scenarios/manage/id/clone'
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     req.userRole = 3
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     req.user = {
    //         displayName: "Arie",
    //         emails: ["arie@ScopedCredential.com"]
    //     }
    //
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             const data = res._getData();
    //             expect(data).to.be.of.a("string")
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })
    //
    // it('Get scenario snapshot', (done) => {
    //     let req = http_mocks.createRequest({
    //         method: 'GET',
    //         url: '/scenarios/manage/snapshot/id'
    //     });
    //     req.account = {
    //         name: "myaccount",
    //         id: "1"
    //     }
    //     req.userRole = 3
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //     req.user = {
    //         displayName: "Arie",
    //         emails: ["arie@ScopedCredential.com"]
    //     }
    //
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             const data = res._getData();
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // })

});
