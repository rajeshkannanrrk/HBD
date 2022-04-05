import * as supertest from "supertest";
import { expect } from "chai";
import * as sinon from "sinon";
import { users, login, toggleSysAdminMode } from "./loginService";
import { tenantName } from "./consts";
import { getXSRFToken } from "./getXSRFToken";
import { app } from "../app";
import * as mainModel from "../models/admin-portal-v3/main.model";
import { SkillInfo } from "healthbotcommon/tenantcontent";

const pathTo = (path = "") => `/account/${tenantName}/integration/skills${path}`;
const skillMsAppId = '74b0b2ca-47fa-4a3f-bd36-72ec8d07fc65';
const consumerMsAppId = '74b0b2ca-47fa-4a3f-bd36-72ec8d07fc65';

describe("Integration - Skills (Consume)", function () {
    this.timeout(10000);

    const manifestUrl = "https://bot-api-us.healthbot-dev.microsoft.com/bot/dynabot/api-test-bot-bwatiq5/skill/manifest";

    const expectedReturnedSkill: Omit<SkillInfo, 'endpointUrl' | 'msAppId'> = {
        name: "api-test-bot",
        description: "api-test-bot description",
        publisherName: "api-test-bot publisher",
        manifestUrl,
    };

    const skill: SkillInfo = {
        ...expectedReturnedSkill,
        endpointUrl: "https://bot-api-us.healthbot-dev.microsoft.com/bot/dynabot/api-test-bot-bwatiq5/skill/consume",
        msAppId: skillMsAppId
    };

    function expectReloadTenant() {
        expect(mainModel.reloadTenant.calledOnce).to.be.true;
        expect(mainModel.reloadTenant.getCall(0).args[0]).eq(tenantName);
    }

    [
        [users.editor, "editor"] as const,
        [users.admin, "admin"] as const,
        [users.sysAdmin, "sys admin in write mode"] as const
    ].forEach(([user, userType]) => {
        describe(`Happy path - ${userType}`, () => {
            const sandbox = sinon.createSandbox();

            let request: supertest.SuperAgentTest;
            let _csrf: string;

            before(async () => {
                request = supertest.agent(app);

                await login(user, request);

                if (user === users.sysAdmin) {
                    await toggleSysAdminMode(request);
                }
            });

            beforeEach(() => {
                sandbox.spy(mainModel, "reloadTenant");
            });

            afterEach(() => {
                sandbox.restore();
            });

            it("should return SkillConsumerConfig object with empty skills array", async () => {
                const actual = await request
                    .get(pathTo("/consume/config"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Object");
                expect(actual.body.skills).to.be.an("Array").that.is.empty;
                expect(actual.body.appId).to.be.a("String").that.is.equal(consumerMsAppId);
            });

            it("should return SkillInfo object with skill data", async () => {
                const actual = await request
                    .get(pathTo("/consume/fetchManifest"))
                    .query({ manifestUrl })
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Object");
                expect(actual.body.name).to.be.a("String").that.is.equal("api-test-bot");
                expect(actual.body.description).to.be.a("String").that.is.equal("api-test-bot description");
                expect(actual.body.publisherName).to.be.a("String").that.is.equal("api-test-bot publisher");
                expect(actual.body.manifestUrl).to.be.a("String").that.is.equal("https://bot-api-us.healthbot-dev.microsoft.com/bot/dynabot/api-test-bot-bwatiq5/skill/manifest");
                expect(actual.body.endpointUrl).to.be.a("String").that.is.equal("https://bot-api-us.healthbot-dev.microsoft.com/bot/dynabot/api-test-bot-bwatiq5/skill/consume");
                expect(actual.body.msAppId).to.be.a("String").that.is.equal(skillMsAppId);
            });

            it("should register a new skill", async () => {
                await request
                    .post(pathTo("/consume/newSkill"))
                    .send({
                        ...skill,
                        _csrf
                    })
                    .expect(200);

                expectReloadTenant();
            });

            it("should return SkillConsumerConfig object with the new skill in the skills array", async () => {
                const actual = await request
                    .get(pathTo("/consume/config"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Object");
                expect(actual.body.skills).to.be.an("Array").of.length(1);
                expect(actual.body.skills[0]).to.be.an("Object").that.contains(expectedReturnedSkill);
            });

            it("should refresh the registered skill", async () => {
                await request
                    .put(pathTo("/consume/registeredSkill"))
                    .send({
                        manifestUrl,
                        _csrf
                    })
                    .expect(200);

                expectReloadTenant();
            });

            it("should return SkillConsumerConfig object with the refreshed skill in the skills array which is unchanged", async () => {
                const actual = await request
                    .get(pathTo("/consume/config"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Object");
                expect(actual.body.skills).to.be.an("Array").of.length(1);
                expect(actual.body.skills[0]).to.be.an("Object").that.contains(expectedReturnedSkill);
            });

            it("should delete the registered skill", async () => {
                await request
                    .delete(pathTo("/consume/registeredSkill"))
                    .query({ manifestUrl })
                    .send({
                        _csrf
                    })
                    .expect(200);

                expectReloadTenant();
            });

            it("should return SkillConsumerConfig object without deleted skill", async () => {
                const actual = await request
                    .get(pathTo("/consume/config"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Object");
                expect(actual.body.skills).to.be.an("Array").that.is.empty;
            });

            it("should register a new skill after deletion", async () => {
                await request
                    .post(pathTo("/consume/newSkill"))
                    .send({
                        ...skill,
                        _csrf
                    })
                    .expect(200);

                expectReloadTenant();
            });

            it("should reset all skills", async () => {
                await request
                    .put(pathTo("/consume/reset"))
                    .send({
                        _csrf
                    })
                    .expect(200);

                expectReloadTenant();
            });

            it("should return SkillConsumerConfig with empty skillsobject", async () => {
                const actual = await request
                    .get(pathTo("/consume/config"))
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body).to.be.an("Object");
                expect(actual.body.skills).to.be.an("Array").that.is.empty;
            });

        });


        describe("Error Handling", () => {
            it("POST /consume/newSkill should fail with 403 when user is reader", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.reader, request);

                await request
                    .post(pathTo("/consume/newSkill"))
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(403, "Readers are not allowed for this operations");
            });

            it("POST /consume/newSkill should fail with 403 when user is sys admin in readonly mode", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .post(pathTo("/consume/newSkill"))
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(403, "System Admin in read only mode");
            });

            it("PUT /consume/reset should fail with 403 when user is reader", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.reader, request);

                await request
                    .put(pathTo("/consume/reset"))
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(403, "Readers are not allowed for this operations");
            });

            it("PUT /consume/reset should fail with 403 when user is sys admin in readonly mode", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .put(pathTo("/consume/reset"))
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(403, "System Admin in read only mode");
            });

            it("PUT /consume/registeredSkill should fail with 403 when user is reader", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.reader, request);

                await request
                    .put(pathTo("/consume/registeredSkill"))
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(403, "Readers are not allowed for this operations");
            });

            it("PUT /consume/registeredSkill should fail with 403 when user is sys admin in readonly mode", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .put(pathTo("/consume/registeredSkill"))
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(403, "System Admin in read only mode");
            });

            it("DELETE /consume/registeredSkill should fail with 403 when user is reader", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.reader, request);

                await request
                    .delete(pathTo("/consume/registeredSkill"))
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(403, "Readers are not allowed for this operations");
            });

            it("DELETE /consume/registeredSkill should fail with 403 when user is sys admin in readonly mode", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .delete(pathTo("/consume/registeredSkill"))
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(403, "System Admin in read only mode");
            });

            it("POST /consume/newSkill should fail with 400 when skill is already registered", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.editor, request);

                await request
                    .post(pathTo("/consume/newSkill"))
                    .send({
                        ...skill,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(200);

                await request
                    .post(pathTo("/consume/newSkill"))
                    .send({
                        ...skill,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(400, "Manifest already exists");
            });

            it("PUT /consume/registeredSkill should fail with 400 when skill is not registered", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.editor, request);

                await request
                    .put(pathTo("/consume/reset"))
                    .send({
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(200);

                await request
                    .put(pathTo("/consume/registeredSkill"))
                    .send({
                        ...skill,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(400, "Error while refreshing skill");
            });

            it("DELETE /consume/registeredSkill should succeed when skill is not registered", async () => {
                const request = supertest.agent(app);
                const loginRes = await login(users.editor, request);

                await request
                    .delete(pathTo("/consume/registeredSkill"))
                    .query({ manifestUrl })
                    .send({ _csrf: getXSRFToken(loginRes) })
                    .expect(200);
            });

        });
    });
});
