import * as supertest from "supertest";
import { expect } from "chai";
import * as sinon from "sinon";
import { users, login, toggleSysAdminMode } from "./loginService";
import { tenantName } from "./consts";
import { getXSRFToken } from "./getXSRFToken";
import { app } from "../app";
import * as mainModel from "../models/admin-portal-v3/main.model";

const pathTo = (path = "") => `/account/${tenantName}/scenarios/manage${path}`;

const scenarioProperties = {
    name: "New Scenario",
    trigger: "NewScenario",
    description: "Description for new scenario"
};

const updatedScenarioProperties = {
    name: "Updated New Scenario",
    trigger: "UpdatedNewScenario",
    description: "Updated description for new scenario"
};

const clonedScenarioProperties = {
    name: "Updated New Scenario_copy",
    trigger: "UpdatedNewScenario_copy",
    description: "Updated description for new scenario"
};

describe("Scenarios - Manage", function () {
    this.timeout(10000);

    function expectReloadScenario() {
        expect(mainModel.reloadScenario.calledOnce).to.be.true;
        expect(mainModel.reloadScenario.getCall(0).args[0]).eq(tenantName);
    }

    function expectTwiceReloadScenario() {
        expect(mainModel.reloadScenario.calledTwice).to.be.true;
        expect(mainModel.reloadScenario.getCall(0).args[0]).eq(tenantName);
        expect(mainModel.reloadScenario.getCall(1).args[0]).eq(tenantName);
    }

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


            let scenarioId: string;
            let clonedScenarioId: string;
            let snapshotId: string;

            before(async () => {
                request = supertest.agent(app);

                await login(user, request);

                if (user === users.sysAdmin) {
                    await toggleSysAdminMode(request);
                }
            });

            after( async () => {
                // Cleanup
                const res = await request
                    .get(pathTo("/all"));

                await request
                    .post(pathTo("/delete"))
                    .send({
                        ids: res.body.map((scenario) => scenario.RowKey),
                        _csrf: getXSRFToken(res)
                    });
            });

            beforeEach(() => {
                sandbox.spy(mainModel, "reloadScenario");
                sandbox.spy(mainModel, "reloadTenant");
            });

            afterEach(() => {
                sandbox.restore();
            });


            it("should return an empty array of scenarios", async () => {
                const actual = await request
                    .get(pathTo("/all"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Array").that.is.empty;
            });

            it("should add a scenario", async () => {
                const actual = await request
                    .post(pathTo("/add"))
                    .send(
                        {
                            ...scenarioProperties,
                            _csrf
                        }
                    )
                    .expect(200)
                    .expect("content-type", 'text/html; charset=utf-8');


                _csrf = getXSRFToken(actual);

                expect(actual.text).to.be.a("String");
                expectReloadScenario();
                scenarioId = actual.text;
            });

            it("should create a snapshot for the created scenario", async () => {
                const actual = await request
                    .post(pathTo(`/snapshot/${scenarioId}`))
                    .send(
                        {
                            _csrf
                        }
                    )
                    .expect(200)
                    .expect("content-type", 'application/json; charset=utf-8');


                _csrf = getXSRFToken(actual);

                expect(actual.text).to.be.a("String");
            });

            it("should return a list of snapshots of size 1", async () => {
                const actual = await request
                    .get(pathTo(`/snapshot/${scenarioId}`))
                    .expect(200)
                    .expect("content-type", /json/);


                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("Array").of.length(1);
                snapshotId = actual.body[0].name.split('/')[1];
            });

            it("should get the scenario metadata", async () => {
                const actual = await request
                    .get(pathTo(`/${scenarioId}`))
                    .expect(200)
                    .expect("content-type", /json/);
                expect(actual.body.name).to.be.a("String").that.is.equal(scenarioProperties.name);
                expect(actual.body.description).to.be.a("String").that.is.equal(scenarioProperties.description);
                expect(actual.body.trigger).to.be.a("String").that.is.equal(scenarioProperties.trigger);

            });

            it("should update the scenario metadata", async () => {
                await request
                    .put(pathTo(`/${scenarioId}`))
                    .send( {
                        ...updatedScenarioProperties,
                        _csrf
                    })
                    .expect(200);

                expectReloadScenario();
            });

            it("should get the updated scenario metadata", async () => {
                const actual = await request
                    .get(pathTo(`/${scenarioId}`))
                    .expect(200)
                    .expect("content-type", /json/);
                expect(actual.body.name).to.be.a("String").that.is.equal(updatedScenarioProperties.name);
                expect(actual.body.description).to.be.a("String").that.is.equal(updatedScenarioProperties.description);
                expect(actual.body.trigger).to.be.a("String").that.is.equal(updatedScenarioProperties.trigger);

            });

            it("should get scenario state as enabled", async () => {
                const actual = await request
                    .get(pathTo(`/${scenarioId}/activeState`))
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body).to.be.a("Boolean").that.is.equal(true);
                _csrf = getXSRFToken(actual);
            });

            it("should set scenario state as disabled", async () => {
                const actual = await request
                    .post(pathTo(`/${scenarioId}/deactivate`))
                    .send({ _csrf })
                    .expect(200);

                _csrf = getXSRFToken(actual);

                expectReloadScenario();
            });

            it("should get scenario state as disabled", async () => {
                const actual = await request
                    .get(pathTo(`/${scenarioId}/activeState`))
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body).to.be.a("Boolean").that.is.equal(false);
                _csrf = getXSRFToken(actual);
            });


            it("should get suggested properties for a cloned scenario", async () => {
                const actual = await request
                    .get(pathTo(`/clone/${scenarioId}`))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body.name).to.be.a("String").that.is.equal(clonedScenarioProperties.name);
                expect(actual.body.description).to.be.a("String").that.is.equal(clonedScenarioProperties.description);
                expect(actual.body.trigger).to.be.a("String").that.is.equal(clonedScenarioProperties.trigger);
            });

            it("should clone a scenario", async () => {
                const actual = await request
                    .post(pathTo(`/${scenarioId}/clone`))
                    .send({
                        ...clonedScenarioProperties,
                        _csrf
                    })
                    .expect(200)
                    .expect("content-type", 'text/html; charset=utf-8');

                _csrf = getXSRFToken(actual);

                expectReloadScenario();
                clonedScenarioId = actual.text;
            });

            it("should delete the scenarios", async () => {
                const actual = await request
                    .post(pathTo("/delete"))
                    .send({
                        ids: [scenarioId, clonedScenarioId],
                        _csrf
                    })
                    .expect(200)
                    .expect("content-type", 'text/html; charset=utf-8');

                _csrf = getXSRFToken(actual);

                expect(actual.text).to.be.a("String");
                expectTwiceReloadScenario();

            });

            it("should import a scenario from a file", async () => {
                const actual = await request
                    .post(pathTo("/import"))
                    .set("xsrf-token", _csrf)
                    .attach("f_0", "api-test/fixtures/import_test.json")
                    .expect(200)
                    .expect("content-type", 'text/plain; charset=utf-8');

                expectReloadTenant();

                _csrf = getXSRFToken(actual);
            });

            it("should get the imported scenario", async () => {
                const res = await request
                    .get(pathTo("/all"))
                    .expect(200)
                    .expect("content-type", /json/);

                expect(res.body).to.be.an("Array").of.length(1);
                expect(res.body[0].name).to.be.equal('Import Test');

            });

        });


        describe("Error Handling", () => {
            let request: supertest.SuperAgentTest;

            beforeEach(() => {
                request = supertest.agent(app);
            });

            it("POST /add should fail with 403 when user is reader", async () => {
                const loginRes = await login(users.reader, request);

                await request
                    .post(pathTo("/add"))
                    .send(
                        {
                            ...scenarioProperties,
                            _csrf: getXSRFToken(loginRes)
                        }
                    )
                    .expect(403, "Readers not allowed for this operations");
            });

            it("POST /add should fail with 403 when user is sys admin in read only mode", async () => {
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .post(pathTo("/add"))
                    .send(
                        {
                            ...scenarioProperties,
                            _csrf: getXSRFToken(loginRes)
                        }
                    )
                    .expect(403, "System Admin in read only mode");
            });

            it("POST /snapshot/123 should fail with 403 when user is reader", async () => {
                const loginRes = await login(users.reader, request);

                await request
                    .post(pathTo(`/snapshot/123`))
                    .send(
                        {
                            _csrf: getXSRFToken(loginRes)
                        }
                    )
                    .expect(403, "Readers not allowed for this operations");
            });

            it("POST /snapshot/123 should fail with 403 when user is sys admin in read only mode", async () => {
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .post(pathTo(`/snapshot/123`))
                    .send(
                        {
                            _csrf: getXSRFToken(loginRes)
                        }
                    )
                    .expect(403, "System Admin in read only mode");
            });

            it("POST /snapshot/123 should fail with 404 when user is admin and scenario doesn't exists", async () => {
                const loginRes = await login(users.admin, request);

                await request
                    .post(pathTo(`/snapshot/123`))
                    .send(
                        {
                            _csrf: getXSRFToken(loginRes)
                        }
                    )
                    .expect(404);
            });

            it("PUT /123 should fail with 403 when user is reader", async () => {
                const loginRes = await login(users.reader, request);

                await request
                    .put(pathTo(`/123`))
                    .send( {
                        ...updatedScenarioProperties,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(403, "Readers not allowed for this operations");
            });

            it("PUT /123 should fail with 403 when user is sys admin in read only mode", async () => {
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .put(pathTo(`/123`))
                    .send( {
                        ...updatedScenarioProperties,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(403, "System Admin in read only mode");
            });

            it("PUT /123 should fail with 404 when user is admin and scenario doesn't exists", async () => {
                const loginRes = await login(users.admin, request);

                await request
                    .put(pathTo(`/123`))
                    .send( {
                        ...updatedScenarioProperties,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(404);
            });

            it("POST /123/deactivate should fail with 403 when user is reader", async () => {
                const loginRes = await login(users.reader, request);

                await request
                    .post(pathTo(`/123/deactivate`))
                    .send({
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(403, "Readers not allowed for this operations");
            });

            it("POST /123/deactivate should fail with 403 when user is sys admin in read only mode", async () => {
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .post(pathTo(`/123/deactivate`))
                    .send({
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(403, "System Admin in read only mode");
            });

            it("POST /123/deactivate should fail with 500 when user is admin and scenario doesn't exists", async () => {
                const loginRes = await login(users.admin, request);

                await request
                    .post(pathTo(`/123/deactivate`))
                    .send({
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(500);
            });

            it("POST /123/clone should fail with 403 when user is reader", async () => {
                const loginRes = await login(users.reader, request);

                await request
                    .post(pathTo(`/123/clone`))
                    .send({
                        ...clonedScenarioProperties,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(403, "Readers not allowed for this operations");
            });

            it("POST /123/clone should fail with 403 when user is sys admin in read only mode", async () => {
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .post(pathTo(`/123/clone`))
                    .send({
                        ...clonedScenarioProperties,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(403, "System Admin in read only mode");
            });

            it("POST /123/clone should fail with 404 when user is admin and scenario doesn't exists", async () => {
                const loginRes = await login(users.admin, request);

                await request
                    .post(pathTo(`/123/clone`))
                    .send({
                        ...clonedScenarioProperties,
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(404);
            });

            it("DELETE should fail with 403 when user is reader", async () => {
                const loginRes = await login(users.reader, request);

                await request
                    .post(pathTo("/delete"))
                    .send({
                        ids: ["123", "456"],
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(403, "Readers not allowed for this operations");
            });

            it("DELETE should fail with 403 when user is sys admin in read only mode", async () => {
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .post(pathTo("/delete"))
                    .send({
                        ids: ["123", "456"],
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(403, "System Admin in read only mode");
            });

            it("DELETE should fail with 404 when user is admin and scenario doesn't exists", async () => {
                const loginRes = await login(users.admin, request);

                await request
                    .post(pathTo("/delete"))
                    .send({
                        ids: ["123", "456"],
                        _csrf: getXSRFToken(loginRes)
                    })
                    .expect(404);
            });

            it("POST /import should fail with 403 when user is reader", async () => {
                const loginRes = await login(users.reader, request);

                await request
                    .post(pathTo("/import"))
                    .set("xsrf-token", getXSRFToken(loginRes))
                    .attach("f_0", "api-test/fixtures/import_test.json")
                    .expect(403, "Readers not allowed for this operations");
            });

            it("POST /import should fail with 403 when user is sys admin in read only mode", async () => {
                const loginRes = await login(users.sysAdmin, request);

                await request
                    .post(pathTo("/import"))
                    .set("xsrf-token", getXSRFToken(loginRes))
                    .attach("f_0", "api-test/fixtures/import_test.json")
                    .expect(403, "System Admin in read only mode");
            });

        });
    });
});
