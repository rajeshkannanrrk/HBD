import * as supertest from "supertest";
import * as sinon from "sinon";
import { tenantName } from "./consts";
import { login, toggleSysAdminMode, users } from "./loginService";
import { app } from "../app";
import * as mainModel from "../models/admin-portal-v3/main.model";
import { getXSRFToken } from "./getXSRFToken";
import { expect } from "chai";

const pathTo = (path = "") => `/account/${tenantName}/integration/authentication${path}`;

describe("Integration - Authentication Providers", function () {
    this.timeout(10000);

    const authProvider = {
        type: "oauth2",
        name: "auth provider",
        description: "an amazing auth provider",
        oauth2_client_id: "oauth2 client id",
        oauth2_client_secret: "oauth2 client secret",
        oauth2_authorization_url: "oauth2 auth url",
        oauth2_access_token_url: "oauth2 token url",
        oauth2_scope: "oauth2 scope"
    };

    [
        [users.editor, "editor"] as const,
        [users.admin, "admin"] as const,
        [users.sysAdmin, "sys admin in write mode"] as const
    ].forEach(([user, role]) => {
        const sandbox = sinon.createSandbox();
        const updatedAuthProvider = {
            type: "server2server",
            name: "updated auth provider",
            description: "an amazing update auth provider",
            oauth2_client_id: "updated oauth2 client id",
            oauth2_client_secret: "updated oauth2 client secret",
            oauth2_authorization_url: "updated oauth2 auth url",
            oauth2_access_token_url: "updated oauth2 token url",
            oauth2_scope: "updated oauth2 scope"
        };

        let request: supertest.SuperAgentTest;
        let _csrf: string;
        let authProviderId: string;

        describe(`Happy path - ${role}`, () => {
            before(async () => {
                request = supertest.agent(app);

                await login(user, request);

                if (user === users.sysAdmin) {
                    await toggleSysAdminMode(request);
                }
            });

            beforeEach(() => {
                sandbox.spy(mainModel, "reloadDataConnections");
            });

            afterEach(() => {
                sandbox.restore();
            });

            it("should return empty list of auth providers", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Array").that.is.empty;
            });

            it("should create a new auth provider", async () => {
                await request
                    .post(pathTo())
                    .send({
                        ...authProvider,
                        _csrf
                    })
                    .expect(200);

                expectReloadDataConnections();
            });

            it("should return list of auth providers containing new provider", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Array").of.length(1);
                expect(actual.body[0]).to.be.an("Object").that.contains(authProvider);
                expect(actual.body[0].id).to.be.a("String");

                authProviderId = actual.body[0].id;
            });

            it("should update an existing auth provider", async () => {
                await request
                    .put(pathTo(`/${authProviderId}`))
                    .send({
                        ...updatedAuthProvider,
                        _csrf
                    })
                    .expect(200);

                expectReloadDataConnections();
            });

            it("should return list of auth providers with updated provider", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body[0]).to.be.an("Object").that.contains({
                    ...updatedAuthProvider,
                    id: authProviderId
                });
            });

            it("should delete an existing auth provider", async () => {
                await request
                    .delete(pathTo(`/${authProviderId}`))
                    .send({ _csrf })
                    .expect(200);

                expectReloadDataConnections();
            });

            it("should return list of auth providers without deleted provider", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.some((dc) => dc.id === authProviderId)).to.be.false;
            });

            function expectReloadDataConnections() {
                expect(mainModel.reloadDataConnections.calledOnce).to.be.true;
                expect(mainModel.reloadDataConnections.getCall(0).args[0]).eq(tenantName);
            }
        });
    });

    describe("Error Handling", () => {
        it("POST / should fail with 403 when user is reader", async () => {
            const request = supertest.agent(app);
            const loginRes = await login(users.reader, request);

            await request
                .post(pathTo())
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "Readers not allowed for this operations");
        });

        it("POST / should fail with 403 when user is sys admin in readonly mode", async () => {
            const request = supertest.agent(app);
            const loginRes = await login(users.sysAdmin, request);

            await request
                .post(pathTo())
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "System Admin in read only mode");
        });

        it("PUT /:id should fail with 403 when user is reader", async () => {
            const request = supertest.agent(app);
            const loginRes = await login(users.reader, request);

            await request
                .put(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "Readers not allowed for this operations");
        });

        it("PUT /:id should fail with 403 when user is sys admin in readonly mode", async () => {
            const request = supertest.agent(app);
            const loginRes = await login(users.sysAdmin, request);

            await request
                .put(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "System Admin in read only mode");
        });

        it("PUT /:id should succeed when id does not exist", async () => {
            const request = supertest.agent(app);
            const loginRes = await login(users.editor, request);
            const id = generateId();

            await request
                .put(pathTo(`/${id}`))
                .send({ ...authProvider, _csrf: getXSRFToken(loginRes) })
                .expect(200);

            const actual = await request
                .get(pathTo("/read"))
                .expect(200)
                .expect("content-type", /json/);

            expect(actual.body.some((dc) => dc.id === id)).to.be.true;

            await request
                .delete(pathTo(`/${id}`))
                .send({ _csrf: getXSRFToken(actual) })
                .expect(200);
        });

        it("DELETE /:id should fail with 403 when user is reader", async () => {
            const request = supertest.agent(app);
            const loginRes = await login(users.reader, request);

            await request
                .delete(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "Readers not allowed for this operations");
        });

        it("DELETE /:id should fail with 403 when user is sys admin in readonly mode", async () => {
            const request = supertest.agent(app);
            const loginRes = await login(users.sysAdmin, request);

            await request
                .delete(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "System Admin in read only mode");
        });

        it("DELETE /:id should succeed when id does not exist", async () => {
            const request = supertest.agent(app);
            const loginRes = await login(users.editor, request);

            await request
                .delete(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(200);
        });

        function generateId() {
            return new Date().getTime().toString();
        }
    });
});
