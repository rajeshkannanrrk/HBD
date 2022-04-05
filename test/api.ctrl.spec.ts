const stars = "\n********************************************************************\n";
import {expect} from 'chai';
const http_mocks = require('node-mocks-http');
const globals = require('../modules/globals');
import * as jwt from 'jsonwebtoken';

import * as mainModel from "../models/admin-portal-v3/main.model";
const router = require('../controllers/admin-portal-api/api.ctrl').router;
const sinon = require('sinon');

import {mockScenarioBlob, mockBlobService, mocktTenantCosmosTableService, mockTenantStorageTableService} from './mocks/data/scenarios';

describe(stars + "HealthBotDashboard > Controller > API" + stars, () => {

    let jwtToken;

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
                       mockBlobService ,
                       mockTenantStorageTableService,
                       mocktTenantCosmosTableService,
                       null,
                       null,
                       null,
                       null,
                       {getSecret:(name) => null },
                       mockReloadTenant,
                       mockSendErrorToClient,
                       mockReloadTenantScenario,
                       null, null, null,null, null, null, null);

        globals.tenants["myaccount"] = {
            name:"myaccount",
            id: "1",
            api_jwt_secret: "1234"
        }

        globals.tenantContents["myaccount"] = {auditTrails: {log: sinon.stub()}};


        jwtToken = jwt.sign({tenantName:'myaccount'}, "1234");
    });

    after(() => {
        delete globals.tenantContents['myaccount'];
    })

    // it('get all scenarios', (done)=> {
    //
    //     const req  = http_mocks.createRequest({
    //         method: 'GET',
    //         url: '/account/myaccount/scenarios',
    //         headers: {
    //             "Authorization": "Bearer " + jwtToken
    //         }
    //     });
    //
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //
    //     res.on('end', () => {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             const data = res._getData();
    //             expect(data[0].scenario_trigger).to.be.equal("trigger1");
    //             const code = JSON.parse(data[0].code);
    //             expect(code.steps).to.have.lengthOf(1)
    //             expect(code).to.be.eql(mockScenarioBlob);
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // });
    //
    // it('import scenario', (done)=> {
    //     let req  = http_mocks.createRequest({
    //         method: 'POST',
    //         url: '/account/myaccount/scenarios',
    //         headers: {
    //             "Authorization": "Bearer " + jwtToken,
    //             "Content-Type": "application/json",
    //             "Content-Length": "100"
    //         },
    //         body: {
    //             name: "scenario1",
    //             scenario_trigger: "scenario1",
    //             active: true,
    //             code: JSON.stringify(mockScenarioBlob)
    //         }
    //     });
    //
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //
    //     res.on('end', ()=> {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             expect(res._getData()).to.be.equal("OK");
    //             done();
    //         }
    //         catch(err) {
    //             done(err);
    //         }
    //     })
    //     router.handle(req, res);
    // });
    //
    // it('delete scenario', (done) => {
    //     let req  = http_mocks.createRequest({
    //         method: 'DELETE',
    //         url: '/account/myaccount/scenarios/1',
    //         headers: {
    //             "Authorization": "Bearer " + jwtToken,
    //             "Content-Type": "application/json"
    //         }
    //     });
    //
    //     let res = http_mocks.createResponse({
    //         eventEmitter: require('events').EventEmitter
    //     });
    //
    //     res.on('end', ()=> {
    //         try {
    //             expect(res.statusCode).to.be.equal(200);
    //             expect(res._getData()).to.be.equal("OK");
    //             done();
    //         }
    //         catch (err) {
    //             done(err);
    //         }
    //     })
    //
    //     router.handle(req, res);
    // })

    /*** Failures ****/

    it('jwt missing', (done)=> {
        const req  = http_mocks.createRequest({
            method: 'GET',
            url: '/account/myaccount/scenarios',
            headers: {
                "Authorization": "Bearer "
            }
        });

        let res = http_mocks.createResponse({
            eventEmitter: require('events').EventEmitter
        });

        res.on('end', ()=> {
            try {
                expect(res.statusCode).to.be.equal(400);
                expect(res._getData()).to.be.equal("Authorization header - wrong format");
                done();
            }
            catch(err) {
                done(err);
            }
        })

        router.handle(req, res);
    });

    it('wrong tenant', (done)=> {
        const req  = http_mocks.createRequest({
            method: 'GET',
            url: '/account/myaccount1/scenarios',
            headers: {
                "Authorization": "Bearer " + jwtToken
            }
        });

        let res = http_mocks.createResponse({
            eventEmitter: require('events').EventEmitter
        });

        res.on('end', ()=> {
            try {
                expect(res.statusCode).to.be.equal(404);
                expect(res._getData()).to.be.equal("404: Account not Found");
                done();
            }
            catch (err) {
                done(err);
            }
        })
        router.handle(req, res);
    });

    it('wrong payload', (done)=> {
        const req  = http_mocks.createRequest({
            method: 'POST',
            url: '/account/myaccount/scenarios',
            headers: {
                "Authorization": "Bearer " + jwtToken
            },
            body: {
                name: "scenario",
                active: true,
                code: JSON.stringify({steps:[]})
            }
        });

        let res = http_mocks.createResponse({
            eventEmitter: require('events').EventEmitter
        });

        res.on('end', ()=> {
            try {
                expect(res.statusCode).to.be.equal(400);
                expect(res._getData()).to.be.equal("Content type should be application/json");
                done();
            }
            catch(err) {
                done(err);
            }
        })
        router.handle(req, res);
    });

    it('wrong path', (done)=> {
        const req  = http_mocks.createRequest({
            method: 'GET',
            url: '/account/myaccount/dummy',
            headers: {
                "Authorization": "Bearer " + jwtToken
            }
        });

        let res = http_mocks.createResponse({
            eventEmitter: require('events').EventEmitter
        });

        res.on('end', ()=> {
            try {
                expect(res.statusCode).to.be.equal(404);
                expect(res._getData()).to.be.equal("404: Page not Found");
                done();
            }
            catch(err) {
                done(err);
            }
        })
        router.handle(req, res);
    });


});
