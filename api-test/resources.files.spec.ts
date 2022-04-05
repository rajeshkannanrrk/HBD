import "dotenv/config";

import * as supertest from "supertest";
import { expect } from "chai";
import { users, login, toggleSysAdminMode } from "./loginService";
import { tenantName } from "./consts";
import { getXSRFToken } from "./getXSRFToken";
import { expectUrlNotToContainSasToken } from "./resourcesUtils";
import { app } from "../app";

const pathTo = (path = "") => `/account/${tenantName}/resources/files${path}`;

describe("Resources", function () {
    this.timeout(10000);
    
    [
        [users.editor, "editor"] as const,
        [users.admin, "admin"] as const,
        [users.sysAdmin, "sys admin in write mode"] as const
    ].forEach(([user, userType]) => {
        describe(`Happy path - ${userType}`, () => {
            let request: supertest.SuperAgentTest;
            let _csrf: string;

            before(async () => {
                request = supertest.agent(app);

                await login(user, request);

                if (user === users.sysAdmin) {
                    await toggleSysAdminMode(request);
                }
            });

            it("should be able to get current list of resrouces", async () => {
                const actual = await request
                    .get(pathTo("/all"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body).to.be.an("object");
                expect(actual.body.entries).to.be.an("array");
                expect(actual.body.entries).to.have.members(["817JwOqrgNL.jpg", "functional-programming-python-OpenLibra.jpg", "smaller.png"]);
                expect(actual.body.blobUrl).to.be.a("string");
                expectUrlNotToContainSasToken(actual.body.blobUrl);
            });

            it("should return updated resource list after upload", async () => {
                await request
                    .post(pathTo("/upload"))
                    .set("xsrf-token", _csrf)
                    .attach("f_0", "api-test/fixtures/logo.jpg")
                    .expect(200);

                const actual = await request
                    .get(pathTo("/all"))
                    .expect(200)
                    .expect("content-type", /json/);

                _csrf = getXSRFToken(actual);

                expect(actual.body.entries).to.have.members(["817JwOqrgNL.jpg", "functional-programming-python-OpenLibra.jpg", "smaller.png", "logo.jpg"]);

                await supertest(actual.body.blobUrl)
                    .get("/logo.jpg")
                    .expect(200)
                    .expect("content-type", "image/jpeg")
                    .expect("content-length", "3459")
                    .expect("content-md5", "PvNlOBaPz31E3bEHe5R/Kg==");
            });

            it("should return updated resource list after delete", async () => {
                await request
                    .delete(pathTo("/delete"))
                    .query({ name: "logo.jpg" })
                    .send({ _csrf })
                    .expect(200);

                const actual = await request
                    .get(pathTo("/all"))
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.entries).to.have.members(["817JwOqrgNL.jpg", "functional-programming-python-OpenLibra.jpg", "smaller.png"]);

                await supertest(actual.body.blobUrl)
                    .get("/logo.jpg")
                    .expect(404);
            });
        });
    });

    describe("Error Handling", () => {
        let request: supertest.SuperAgentTest;

        beforeEach(() => {
            request = supertest.agent(app);
        });

        it("POST /upload should fail with 403 when user is reader", async () => {
            const loginRes = await login(users.reader, request);

            await request
                .post(pathTo("/upload"))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "Readers not allowed for this operations");
        });

        it("POST /upload should fail with 403 when user is sys admin in read mode", async () => {
            const loginRes = await login(users.sysAdmin, request);

            await request
                .post(pathTo("/upload"))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "System Admin in read only mode");
        });

        it("POST /upload should fail with 400 when file is too large", async () => {
            const loginRes = await login(users.editor, request);

            await request
                .post(pathTo("/upload"))
                .set("xsrf-token", getXSRFToken(loginRes))
                .attach("f_0", "api-test/fixtures/too_large.jpg")
                .expect(400, "File is too large - max size 10MB");
        });

        it("POST /upload should fail with 400 when file name is invalid", async () => {
            const loginRes = await login(users.editor, request);

            await request
                .post(pathTo("/upload"))
                .set("xsrf-token", getXSRFToken(loginRes))
                .attach("f_0", "api-test/fixtures/invalid ,+.jpg")
                .expect(400, "File name is not valid");
        });

        it("DELETE /delete should fail with 403 when user is reader", async () => {
            const loginRes = await login(users.reader, request);

            await request
                .delete(pathTo("/delete"))
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(403, "Readers not allowed for this operations");
        });

        it("DELETE /delete should fail with 404 when file doesn't exist", async () => {
            const loginRes = await login(users.editor, request);

            await request
                .delete(pathTo("/delete"))
                .query({ name: "oops" })
                .send({ _csrf: getXSRFToken(loginRes) })
                .expect(404, "Requested blob 'oops' not found");
        });
    });
});
