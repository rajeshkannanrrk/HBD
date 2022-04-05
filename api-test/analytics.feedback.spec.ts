import { expect } from "chai";
import * as supertest from "supertest";
import { tenantName } from "./consts";
import { login, toggleSysAdminMode, users } from "./loginService";
import { getXSRFToken } from "./getXSRFToken";
import { app } from "../app";

const endpoint = `/account/${tenantName}/analytics/feedback/all`;

describe("Analytics - Feedback", function () {
    this.timeout(10000);

    [
        [users.admin, "admin"] as const,
        [users.sysAdmin, "sys admin"] as const
    ].forEach(([user, role]) => {

        describe(`Happy path - ${role}`, () => {
            let feedbackIds: string[];
            let _csrf = null;

            async function resetFeedbackConfig() {
                const sysAdminSession = supertest.agent(app);

                await login(users.sysAdmin, sysAdminSession);
                const toggleModeResponse = await toggleSysAdminMode(sysAdminSession);
                await sysAdminSession
                    .put(`/account/${tenantName}/configuration/conversation/interactions/save`)
                    .send({
                        automatic_welcome: {},
                        feedback: { enabled: true },
                        general: {},
                        greetings: {},
                        _csrf: getXSRFToken(toggleModeResponse)
                    })
                    .expect(200);
            }

            before(resetFeedbackConfig);
            after(resetFeedbackConfig);

            it("GET /all should return feedback ids", async () => {
                const request = supertest.agent(app);

                await login(user, request);
                const toggleModeResponse = await toggleSysAdminMode(request);
                _csrf = getXSRFToken(toggleModeResponse);

                const actual = await request
                    .post(endpoint)
                    .send({ _csrf })
                    .expect(200)
                    .expect("content-type", /json/);
    
                expect(actual.body).to.be.an("Array");
                expect(actual.body.length).eq(2);
                actual.body.forEach((member) => expect(member).to.be.a("String"));

                feedbackIds = actual.body;
            });

            it("GET /all should return feedback content when feedback id passed in body", async () => {
                const request = supertest.agent(app);

                const res = await login(user, request);

                const { text } = await request
                    .post(endpoint)
                    .send({ ids: feedbackIds, _csrf: getXSRFToken(res) })
                    .expect(200)
                    .expect("content-type", /json/);

                const actual = JSON.parse(text);

                expect(actual).to.be.an("Array");
                expect(actual[0]).to.be.an("Object");
                expect(actual[0].feedback).to.be.a("String");
                expect(actual[0].csat_value).to.be.a("String");
                expect(actual[0].csat_score).to.be.a("Number");

            });

            it("GET /all should return empty array when feedback is disabled", async function () {
                this.timeout(20000);
                
                const sysAdminSession = supertest.agent(app);

                await login(users.sysAdmin, sysAdminSession);
                const toggleModeResponse = await toggleSysAdminMode(sysAdminSession);
                const disableFeedbacksResponse = await sysAdminSession
                    .put(`/account/${tenantName}/configuration/conversation/interactions/save`)
                    .send({
                        automatic_welcome: {},
                        feedback: { enabled: false },
                        general: {},
                        greetings: {},
                        _csrf: getXSRFToken(toggleModeResponse)
                    })
                    .expect(200);

                const userSession = supertest.agent(app);

                const res = await login(user, userSession);

                const actual = await userSession
                    .post(endpoint)
                    .send({ _csrf: getXSRFToken(res) })
                    .expect(200);

                expect(actual.body).to.be.an("Array").that.is.empty;

                await sysAdminSession
                    .put(`/account/${tenantName}/configuration/conversation/interactions/reset`)
                    .send({ _csrf: getXSRFToken(disableFeedbacksResponse) })
                    .expect(200);
            });
        });
    });

    describe("Error handling", () => {
        [
            [users.reader, "reader"] as const,
            [users.editor, "editor"] as const
        ].forEach(([user, role]) => {
            it(`GET /all should render error page when user is ${role}`, async () => {
                const request = supertest.agent(app);
    
                const res = await login(user, request);

                await request
                    .post(endpoint)
                    .send({ _csrf: getXSRFToken(res) })
                    .expect(200, /You can&#39;t access this page/);
            });
        });
    });
});
