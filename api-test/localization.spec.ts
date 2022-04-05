import { expect } from "chai";
import * as supertest from "supertest";
import * as sinon from "sinon";
import * as uuid from "uuid";
import { tenantName } from "./consts";
import { login, toggleSysAdminMode, users } from "./loginService";
import { getXSRFToken } from "./getXSRFToken";
import { expectLocalizationObject } from "./localizationUtils";
import { app } from "../app";
import * as mainModel from "../models/admin-portal-v3/main.model";
import * as globals from "../modules/globals";

const pathTo = (path: string) => `/account/${tenantName}/language-models/localization${path}`;

describe("Localization", function () {
    this.timeout(10000);

    it("GET /locales should return the list of all locales", async () => {
        const request = supertest.agent(app);

        await login(users.reader, request);

        const actual = await request
            .get(pathTo("/locales"))
            .expect(200)
            .expect("content-type", /json/);

        expect(actual.body).to.be.an("Array");
        expect(actual.body.length).eq(22);
        expect(actual.body).to.contain.members([
            "en-us",
            "nl-nl",
            "pl-pl",
            "en-gb",
            "es-mx",
            "ar-sa",
            "cs-cz",
            "fr-ca",
            "fr-fr",
            "ru-ru",
            "sk-sk",
            "zh-cn",
            "pt-pt",
            "et-ee",
            "pt-br",
            "uk-ua",
            "tr-tr",
            "el-gr",
            "ro-ro",
            "it-it",
            "de-de",
            "es-es"
        ]);
    });

    it("GET /localizedStrings should return all localized strings and localization settings", async () => {
        const request = supertest.agent(app);

        await login(users.reader, request);

        const actual = await request
            .get(pathTo("/localizedStrings"))
            .expect(200)
            .expect("content-type", /json/);

        expect(actual.body).to.be.an("Object");
        expect(actual.body.localizedStrings).to.be.an("Object");
        expectLocalizationObject(actual.body.localizedStrings.defaultLocalizedStrings);
        expectLocalizationObject(actual.body.localizedStrings.systemLocalizedStrings);
        expectLocalizationObject(actual.body.localizedStrings.customLocalizedStrings);
        expectLocalizationObject(actual.body.localizedStrings.mergedLocalizedStrings);
        expect(actual.body.settings).to.be.an("Object");
        expect(actual.body.settings.isLocalizationEnabled).to.be.false;
    });

    it("GET /settings should return localization settings", async () => {
        const request = supertest.agent(app);

        await login(users.reader, request);

        const actual = await request
            .get(pathTo("/settings"))
            .expect(200)
            .expect("content-type", /json/);

        expect(actual.body.settings).to.be.an("Object");
        expect(actual.body.settings.isLocalizationEnabled).to.be.false;
        expect(actual.body.languagesJsonObject).to.be.an("Object");
        expect(actual.body.languagesJsonObject).deep.equal(require("../models/admin-portal-v3/language-models/allLocales.json"));
    });

    [
        [users.editor, "editor"] as const,
        [users.admin, "admin"] as const,
        [users.sysAdmin, "sys admin in write mode"] as const
    ].forEach(([user, role]) => {
        describe(`Happy path - ${role}`, () => {
            const sandbox = sinon.createSandbox();
            const systemStringId = uuid.v4();
            const customStringId = uuid.v4();

            let request: supertest.SuperAgentTest;
            let _csrf: string;
            let auditLogSpy: sinon.SinonSpy;

            before(async () => {
                request = supertest.agent(app);

                const loginResult = await login(user, request);

                _csrf = getXSRFToken(loginResult);

                if (user === users.sysAdmin) {
                    await toggleSysAdminMode(request);
                }
            });

            beforeEach(() => {
                sandbox.spy(mainModel, "updateLocalizationSettings");
                sandbox.spy(mainModel, "reloadTenant");

                auditLogSpy = sandbox.spy(globals.tenantContents[tenantName].auditTrails, "log");
            });

            after(async () => {
                await request
                    .post(pathTo("/settings"))
                    .send({
                        isLocalizationEnabled: false,
                        _csrf
                    })
                    .expect(200);
            });

            afterEach(() => {
                sandbox.restore();
            });

            [
                ["system", uuid.v4(), "systemLocalizedStrings"] as const,
                ["custom", uuid.v4(), "customLocalizedStrings"] as const
            ].forEach(([stringType, stringId, localizationObjectName]) => {
                it(`should create a new ${stringType} localized string`, async () => {
                    await request
                        .post(pathTo("/localizedStrings"))
                        .send({
                            [stringType]: [
                                { "string id": stringId, "en-us": "foo" }
                            ],
                            _csrf
                        })
                        .expect(201);

                    expect(mainModel.updateLocalizationSettings.called).to.be.true;
                    expect(mainModel.reloadTenant.called).to.be.true;
                    sinon.assert.calledWith(auditLogSpy, "localization", "modified", user.preferred_username, {localizationType: stringType});
                });

                it(`${stringType} localized strings should contain created string`, async () => {
                    const actual = await request
                        .get(pathTo("/localizedStrings"))
                        .expect(200);
    
                    _csrf = getXSRFToken(actual);
    
                    expect(actual.body.localizedStrings[localizationObjectName].stringIds).to.contain(stringId);
                    expect(actual.body.localizedStrings[localizationObjectName]["en-us"][stringId]).eq("foo");
                });
            });

            it("should create new localized strings", async () => {
                await request
                    .post(pathTo("/localizedStrings"))
                    .send({
                        system: [
                            { "string id": systemStringId, "en-us": "hello" }
                        ],
                        custom: [
                            { "string id": customStringId, "en-us": "world" }
                        ],
                        _csrf
                    })
                    .expect(201);

                expect(mainModel.updateLocalizationSettings.called).to.be.true;
                expect(mainModel.reloadTenant.called).to.be.true;
                sinon.assert.calledWith(auditLogSpy, "localization", "modified", user.preferred_username, {localizationType: "system"});
                sinon.assert.calledWith(auditLogSpy, "localization", "modified", user.preferred_username, {localizationType: "custom"});
            });

            it("localized strings should contain created strings", async () => {
                const actual = await request
                    .get(pathTo("/localizedStrings"))
                    .expect(200);

                _csrf = getXSRFToken(actual);

                expect(actual.body.localizedStrings.systemLocalizedStrings.stringIds).to.contain(systemStringId);
                expect(actual.body.localizedStrings.systemLocalizedStrings["en-us"][systemStringId]).eq("hello");
                expect(actual.body.localizedStrings.customLocalizedStrings.stringIds).to.contain(customStringId);
                expect(actual.body.localizedStrings.customLocalizedStrings["en-us"][customStringId]).eq("world");
                expect(actual.body.localizedStrings.mergedLocalizedStrings.stringIds).to.contain(systemStringId);
                expect(actual.body.localizedStrings.mergedLocalizedStrings["en-us"][systemStringId]).eq("hello");
            });

            it("should update existing strings", async () => {
                await request
                    .post(pathTo("/localizedStrings"))
                    .send({
                        system: [
                            { "string id": systemStringId, "en-us": "hello2" }
                        ],
                        custom: [
                            { "string id": customStringId, "en-us": "world2" }
                        ],
                        _csrf
                    })
                    .expect(201);
            });

            it("localized strings should contain updated strings", async () => {
                const actual = await request
                    .get(pathTo("/localizedStrings"))
                    .expect(200);

                _csrf = getXSRFToken(actual);

                expect(actual.body.localizedStrings.systemLocalizedStrings["en-us"][systemStringId]).eq("hello2");
                expect(actual.body.localizedStrings.customLocalizedStrings["en-us"][customStringId]).eq("world2");
            });

            it("should reset system strings", async () => {
                const actual = await request
                    .delete(pathTo("/localizedStrings/system"))
                    .send({ _csrf })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.status).eq("OK");
                expect(actual.body.localizedStrings).to.be.an("Object");
                expect(mainModel.reloadTenant.called).to.be.true;
                sinon.assert.calledWith(auditLogSpy, "localization", "deleted", user.preferred_username, {localizationType: "system"});
            });

            it("custom system strings should be empty after reset", async () => {
                const actual = await request
                    .get(pathTo("/localizedStrings"))
                    .expect(200);

                _csrf = getXSRFToken(actual);

                expect(actual.body.localizedStrings.systemLocalizedStrings.stringIds).to.be.empty;
            });

            it("should reset custom strings", async () => {
                const actual = await request
                    .delete(pathTo("/localizedStrings/custom"))
                    .send({ _csrf })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.status).eq("OK");
                expect(actual.body.localizedStrings).to.be.an("Object");
                expect(mainModel.reloadTenant.called).to.be.true;
                sinon.assert.calledWith(auditLogSpy, "localization", "deleted", user.preferred_username, {localizationType: "custom"});
            });

            it("custom strings should be empty after reset", async () => {
                const actual = await request
                    .get(pathTo("/localizedStrings"))
                    .expect(200);

                _csrf = getXSRFToken(actual);

                expect(actual.body.localizedStrings.customLocalizedStrings.stringIds).to.be.empty;
            });

            it("should be able to change localization settings", async () => {
                await request
                    .post(pathTo("/settings"))
                    .send({
                        isLocalizationEnabled: true,
                        _csrf
                    })
                    .expect(200, { status: "OK" })
                    .expect("content-type", /json/);

                expect(mainModel.reloadTenant.called).to.be.true;
                sinon.assert.calledWith(auditLogSpy, "localization", "modified", user.preferred_username, {localizationType: "settings"});
            });

            it("should return updated settings", async () => {
                const actual = await request
                    .get(pathTo("/settings"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body.settings.isLocalizationEnabled).to.be.true;
            });
        });
    });

    describe("Error Handling", () => {
        it("POST /localizedStrings should fail when user role is reader", async () => {
            const request = supertest.agent(app);

            const loginResult = await login(users.reader, request);

            await request
                .post(pathTo("/localizedStrings"))
                .send({ _csrf: getXSRFToken(loginResult )})
                .expect(403, "Readers not allowed for this operations");
        });

        it("POST /localizedStrings should fail when user is sys admin in read only mode", async () => {
            const request = supertest.agent(app);

            const loginResult = await login(users.sysAdmin, request);

            await request
                .post(pathTo("/localizedStrings"))
                .send({ _csrf: getXSRFToken(loginResult )})
                .expect(403, "System Admin in read only mode");
        });

        it("DELETE /localizedStrings/system should fail when user role is reader", async () => {
            const request = supertest.agent(app);

            const loginResult = await login(users.reader, request);

            await request
                .delete(pathTo("/localizedStrings/system"))
                .send({ _csrf: getXSRFToken(loginResult )})
                .expect(403, "Readers not allowed for this operations");
        });

        it("DELETE /localizedStrings/system should fail when user is sys admin in read only mode", async () => {
            const request = supertest.agent(app);

            const loginResult = await login(users.sysAdmin, request);

            await request
                .delete(pathTo("/localizedStrings/system"))
                .send({ _csrf: getXSRFToken(loginResult )})
                .expect(403, "System Admin in read only mode");
        });

        it("DELETE /localizedStrings/custom should fail when user role is reader", async () => {
            const request = supertest.agent(app);

            const loginResult = await login(users.reader, request);

            await request
                .delete(pathTo("/localizedStrings/custom"))
                .send({ _csrf: getXSRFToken(loginResult )})
                .expect(403, "Readers not allowed for this operations");
        });

        it("DELETE /localizedStrings/custom should fail when user is sys admin in read only mode", async () => {
            const request = supertest.agent(app);

            const loginResult = await login(users.sysAdmin, request);

            await request
                .delete(pathTo("/localizedStrings/custom"))
                .send({ _csrf: getXSRFToken(loginResult )})
                .expect(403, "System Admin in read only mode");
        });

        it("POST /settings should fail when user role is reader", async () => {
            const request = supertest.agent(app);

            const loginResult = await login(users.reader, request);

            await request
                .post(pathTo("/settings"))
                .send({ _csrf: getXSRFToken(loginResult )})
                .expect(403, "Operation is not allowed for reader user.");
        });

        it("POST /settings should fail when user is sys admin in read only mode", async () => {
            const request = supertest.agent(app);

            const loginResult = await login(users.sysAdmin, request);

            await request
                .post(pathTo("/settings"))
                .send({ _csrf: getXSRFToken(loginResult )})
                .expect(403, "System Admin in read only mode");
        });
    });
});
