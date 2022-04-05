import * as moment from "moment";
import * as jwt from "jsonwebtoken";
import * as supertest from "supertest";
import * as sinon from "sinon";
import * as uuid from "uuid";
import { expect } from "chai";
import { tenantName } from "./consts";
import { expectUrlNotToContainSasToken } from "./resourcesUtils";
import { expectLocalizationObject } from "./localizationUtils";
import { app } from "../app";
import { tenants } from "../modules/globals";
import * as mainModel from "../models/admin-portal-v3/main.model";
import * as globals from "../modules/globals";

describe("API", function () {
    this.timeout(10000);

    let token: string;

    before(async function () {
        token = jwt.sign({
            tenantName,
            iat: moment().unix()
        }, tenants[tenantName].api_jwt_secret);
    });

    describe("Resources", () => {
        const endpoint = `/api/account/${tenantName}/resources`;

        describe("Happy path", () => {
            it("should be able to get current list of resrouces", async () => {
                const actual = await supertest(app)
                    .get(endpoint)
                    .auth(token, { type: "bearer" })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body).to.be.an("object");
                expect(actual.body.entries).to.be.an("array");
                expect(actual.body.entries).to.have.members(["817JwOqrgNL.jpg", "functional-programming-python-OpenLibra.jpg", "smaller.png"]);
                expect(actual.body.blobUrl).to.be.a("string");
                expectUrlNotToContainSasToken(actual.body.blobUrl);
            });

            it("should return updated resource list after upload", async () => {
                await supertest(app)
                    .post(endpoint)
                    .auth(token, { type: "bearer" })
                    .attach("f_0", "api-test/fixtures/logo.jpg")
                    .expect(200);

                const actual = await supertest(app)
                    .get(endpoint)
                    .auth(token, { type: "bearer" })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.entries).to.have.members(["817JwOqrgNL.jpg", "functional-programming-python-OpenLibra.jpg", "smaller.png", "logo.jpg"]);

                await supertest(actual.body.blobUrl)
                    .get("/logo.jpg")
                    .expect(200)
                    .expect("content-type", "image/jpeg")
                    .expect("content-length", "3459")
                    .expect("content-md5", "PvNlOBaPz31E3bEHe5R/Kg==");
            });

            it("should return updated resource list after delete", async () => {
                await supertest(app)
                    .delete(endpoint)
                    .auth(token, { type: "bearer" })
                    .query({ "name[]": "logo.jpg" })
                    .expect(200);

                const actual = await supertest(app)
                    .get(endpoint)
                    .auth(token, { type: "bearer" })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.entries).to.have.members(["817JwOqrgNL.jpg", "functional-programming-python-OpenLibra.jpg", "smaller.png"]);

                await supertest(actual.body.blobUrl)
                    .get("/logo.jpg")
                    .expect(404);
            });
        });

        describe("Error Handling", () => {
            it("POST should fail with 400 when file is too large", async () => {
                await supertest(app)
                    .post(endpoint)
                    .auth(token, { type: "bearer" })
                    .attach("f_0", "api-test/fixtures/too_large.jpg")
                    .expect(400, "File is too large - max size 10MB");
            });

            it("POST should fail with 400 when file name is invalid", async () => {
                await supertest(app)
                    .post(endpoint)
                    .auth(token, { type: "bearer" })
                    .attach("f_0", "api-test/fixtures/invalid ,+.jpg")
                    .expect(400, "File name is not valid");
            });

            it("DELETE should return status 200 ok when file doesn't exist", async () => {
                await supertest(app)
                    .delete(endpoint)
                    .auth(token, { type: "bearer" })
                    .query({ "name[]": "oops" })
                    .expect(200);
            });
        });
    });

    describe("Localization", () => {
        const endpoint = `/api/account/${tenantName}/localization`;

        describe("Happy path", () => {
            const systemStringId = uuid.v4();
            const customStringId = uuid.v4();
            const sandbox = sinon.createSandbox();

            let reloadTenantSpy: sinon.SinonSpy;
            let updateLocalizationSettingsSpy: sinon.SinonSpy;
            let logAuditTrailsSpy: sinon.SinonSpy;

            beforeEach(() => {
                reloadTenantSpy = sandbox.spy(mainModel, "reloadTenant");
                updateLocalizationSettingsSpy = sandbox.spy(mainModel, "updateLocalizationSettings");
                logAuditTrailsSpy = sandbox.spy(globals.tenantContents[tenantName].auditTrails, "log");
            });

            afterEach(() => {
                sandbox.restore();
            });

            it("should be able to get current localization strings", async () => {
                const actual = await supertest(app)
                    .get(endpoint)
                    .auth(token, { type: "bearer" })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body).to.be.an("Object");
                expectLocalizationObject(actual.body.system);
                expectLocalizationObject(actual.body.custom);
            });

            [
                ["system", uuid.v4()] as const,
                ["custom", uuid.v4()] as const
            ].forEach(([stringType, stringId]) => {
                it(`should be able to create a new ${stringType} localized string`, async () => {
                    await supertest(app)
                        .post(endpoint)
                        .auth(token, { type: "bearer" })
                        .send({
                            [stringType]: [
                                { "string id": stringId, "en-us": "foo" }
                            ]
                        })
                        .expect(200);

                    sinon.assert.called(reloadTenantSpy);
                    sinon.assert.called(updateLocalizationSettingsSpy);
                    sinon.assert.calledWith(logAuditTrailsSpy, "localization", "modified", "API", {localizationType: stringType});
                });

                it(`${stringType} localized strings should contain created string`, async () => {
                    const actual = await supertest(app)
                        .get(endpoint)
                        .auth(token, { type: "bearer" })
                        .expect(200)
                        .expect("content-type", /json/);
    
                    expect(actual.body[stringType].stringIds).to.contain(stringId);
                    expect(actual.body[stringType]["en-us"][stringId]).eq("foo");
                });
            });

            it("should be able to add localized strings", async () => {
                await supertest(app)
                    .post(endpoint)
                    .auth(token, { type: "bearer" })
                    .send({
                        system: [
                            { "string id": systemStringId, "en-us": "hello" }
                        ],
                        custom: [
                            { "string id": customStringId, "en-us": "world" }
                        ]
                    })
                    .expect(200);

                sinon.assert.called(reloadTenantSpy);
                sinon.assert.called(updateLocalizationSettingsSpy);
                sinon.assert.calledWith(logAuditTrailsSpy, "localization", "modified", "API", {localizationType: "system"});
                sinon.assert.calledWith(logAuditTrailsSpy, "localization", "modified", "API", {localizationType: "custom"});
            });

            it("localized strings should contain added strings", async () => {
                const actual = await supertest(app)
                    .get(endpoint)
                    .auth(token, { type: "bearer" })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.system.stringIds).to.contain(systemStringId);
                expect(actual.body.system["en-us"][systemStringId]).eq("hello");
                expect(actual.body.custom.stringIds).to.contain(customStringId);
                expect(actual.body.custom["en-us"][customStringId]).eq("world");
            });

            it("should be able to update localized strings", async () => {
                await supertest(app)
                    .post(endpoint)
                    .auth(token, { type: "bearer" })
                    .send({
                        system: [
                            { "string id": systemStringId, "en-us": "hello2" }
                        ],
                        custom: [
                            { "string id": customStringId, "en-us": "world2" }
                        ]
                    })
                    .expect(200);
            });

            it("localized strings should contain updated strings", async () => {
                const actual = await supertest(app)
                    .get(endpoint)
                    .auth(token, { type: "bearer" })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.system.stringIds).to.contain(systemStringId);
                expect(actual.body.system["en-us"][systemStringId]).eq("hello2");
                expect(actual.body.custom.stringIds).to.contain(customStringId);
                expect(actual.body.custom["en-us"][customStringId]).eq("world2");
            });
        });
    });
});
