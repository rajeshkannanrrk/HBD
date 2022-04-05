import * as supertest from "supertest";
import { expect } from "chai";
import * as sinon from "sinon";
import { users, login, toggleSysAdminMode } from "./loginService";
import { tenantName } from "./consts";
import { getXSRFToken } from "./getXSRFToken";
import { app } from "../app";
import * as mainModel from "../models/admin-portal-v3/main.model";

const pathTo = (path = "") => `/account/${tenantName}/integration/data-connections${path}`;

describe("Integration - Data Connections", function () {
    this.timeout(10000);

    const dataConnection = {
        type: "custom",
        name: "data connection 1",
        description: "this is a test data connection",
        base_url: "https://something.com",
        auth_provider: "auth provider 1",
        static_parameters: [{ key: "foo", type: "header", value: "bar" }],
    };

    [
        [users.editor, "editor"] as const,
        [users.admin, "admin"] as const,
        [users.sysAdmin, "sys admin in write mode"] as const
    ].forEach(([user, userType]) => {
        describe(`Happy path - ${userType}`, () => {
            const sandbox = sinon.createSandbox();
            const updatedDataConnection = {
                type: "custom",
                name: "data connection 2",
                description: "this is an updated data connection",
                base_url: "https://something-else.com",
                auth_provider: "auth provider 2",
                static_parameters: [{ key: "bar", type: "url", value: "baz" }],
            };

            let request: supertest.SuperAgentTest;
            let _csrf: string;
            let dataConnectionId: string;

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

            it("should return empty list of data connections", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Array").that.is.empty;
            });

            it("should create a new data connection", async () => {
                await request
                    .post(pathTo())
                    .send({
                        ...dataConnection,
                        _csrf
                    })
                    .expect(200);

                expectReloadDataConnections();
            });

            it("should return list of data connections containing the new data connection", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Array").of.length(1);
                expect(actual.body[0]).to.be.an("Object").that.contains({
                    ...dataConnection,
                    static_parameters: JSON.stringify(dataConnection.static_parameters)
                });
                expect(actual.body[0].id).to.be.a("String");

                dataConnectionId = actual.body[0].id;
            });

            it("should update a data connection", async () => {
                await request
                    .put(pathTo(`/${dataConnectionId}`))
                    .send({
                        ...updatedDataConnection,
                        _csrf
                    })
                    .expect(200);

                expectReloadDataConnections();
            });

            it("should return list of data connections with the updated data connection", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body[0]).to.be.an("Object").that.contains({
                    ...updatedDataConnection,
                    id: dataConnectionId,
                    static_parameters: JSON.stringify(updatedDataConnection.static_parameters)
                });
            });

            it("should delete a data connection", async () => {
                await request
                    .delete(pathTo(`/${dataConnectionId}`))
                    .send({ _csrf })
                    .expect(200);

                expectReloadDataConnections();
            });

            it("should return list of data connections without deleted data connection", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.some((dc) => dc.id === dataConnectionId)).to.be.false;
            });

            function expectReloadDataConnections() {
                expect(mainModel.reloadDataConnections.calledOnce).to.be.true;
                expect(mainModel.reloadDataConnections.getCall(0).args[0]).eq(tenantName);
            }
        });
    });

    describe("Error handling", () => {
        let request: supertest.SuperAgentTest;

        beforeEach(() => {
            request = supertest.agent(app);
        });

        it("POST / should fail with 403 if user role is reader", async () => {
            const loginRes = await login(users.reader, request);

            await request
                .post(pathTo())
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "Readers not allowed for this operations");
        });

        it("POST / should fail with 403 if user role is sys admin in read only mode", async () => {
            const loginRes = await login(users.sysAdmin, request);

            await request
                .post(pathTo())
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "System Admin in read only mode");
        });

        it("PUT /:id should fail with 403 if user role is reader", async () => {
            const loginRes = await login(users.reader, request);

            await request
                .put(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "Readers not allowed for this operations");
        });

        it("PUT /:id should fail with 403 if user role is sys admin in read only mode", async () => {
            const loginRes = await login(users.sysAdmin, request);

            await request
                .put(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "System Admin in read only mode");
        });

        it("PUT /:id should succeed if data connection id doesn't exist", async () => {
            const id = generateId();
            const loginRes = await login(users.editor, request);

            await request
                .put(pathTo(`/${id}`))
                .send({ ...dataConnection, _csrf: getXSRFToken(loginRes) })
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

        it("DELETE /:id should fail with 403 if user role is reader", async () => {
            const loginRes = await login(users.reader, request);

            await request
                .delete(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "Readers not allowed for this operations");
        });

        it("DELETE /:id should fail with 403 if user role is sys admin in read only mode", async () => {
            const loginRes = await login(users.sysAdmin, request);

            await request
                .delete(pathTo(`/${generateId()}`))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "System Admin in read only mode");
        });
        
        it("DELETE /:id should succeed if data connection id doesn't exist", async () => {
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
