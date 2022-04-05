import { expect } from "chai";
import * as sinon from "sinon";
import * as supertest from "supertest";
import { tenantName } from "./consts";
import { login, users } from "./loginService";
import { app } from "../app";

const pathTo = (path: string) => `/account/${tenantName}/analytics/unrecognized-utterances${path}`;

describe("Analytics - Unrecognized Utterances", function () {
    this.timeout(10000);

    [
        [users.reader, "reader"] as const,
        [users.editor, "editor"] as const,
        [users.admin, "admin"] as const,
        [users.sysAdmin, "sys admin"] as const
    ].forEach(([user, role]) => {
        describe(`GET /read - ${role}`, () => {
            let clock: sinon.SinonFakeTimers;
            let request: supertest.SuperAgentTest;

            beforeEach(async () => {
                request = supertest.agent(app);

                await login(user, request);

                clock = sinon.useFakeTimers({
                    now: new Date("2021-08-26").valueOf(),
                    toFake: ["Date"]
                });
            });

            afterEach(() => {
                clock.restore();
            });

            it("should return top 1,000 results", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body).to.be.an("Object");
                expect(actual.body.continuationToken).to.an("Object");
                expect(actual.body.items).to.be.an("Array");
                expect(actual.body.items.length).eq(1000);
                expect(actual.body.items[0]).to.be.an("Object");
                expect(actual.body.items[0].full).to.be.a("String");
                expect(actual.body.items[0].short).to.be.a("String");
                expect(actual.body.items[0].timestamp).to.be.a("String");
            });

            it("should return the next 1,000 results when called with a continuation token", async () => {
                const firstRequest = await request
                    .get(pathTo("/read"))
                    .expect(200)
                    .expect("content-type", /json/);

                const continuationToken = JSON.stringify(firstRequest.body.continuationToken);

                const actual = await request
                    .get(pathTo("/read"))
                    .query({ continuationToken })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.items.length).eq(1000);
            });

            [
                ["day", 20] as const,
                ["week", 40] as const,
                ["month", 60] as const,
                ["year", 80] as const
            ].forEach(([range, expectedResults]) => {
                it(`should return results from last ${range} when range is ${range}`, async () => {
                    const actual = await request
                        .get(pathTo("/read"))
                        .query({ range })
                        .expect(200)
                        .expect("content-type", /json/);

                    expect(actual.body.continuationToken).to.be.null;
                    expect(actual.body.items.length).eq(expectedResults);
                });
            });

            it("should return top 1,000 results when range is forever", async () => {
                const actual = await request
                    .get(pathTo("/read"))
                    .query({ range: "forever" })
                    .expect(200)
                    .expect("content-type", /json/);

                expect(actual.body.continuationToken).to.be.an("Object");
                expect(actual.body.items.length).eq(1000);
            });
        });

        describe(`POST /export - ${role}`, () => {
            it("should return top 50,000 entries in csv format", async function () {
                this.timeout(60000 * 5);

                const request = supertest.agent(app);

                await login(user, request);

                const actual = await request
                    .post(pathTo("/export"))
                    .expect(200)
                    .expect("content-type", /text\/html/);

                const lines = actual.text.split("\n");

                expect(lines.length).eq(50001);

                lines.slice(0, 50000).forEach((line) => expect(line.split(",").length).eq(2));
                expect(lines.slice(-1)[0]).to.be.a("String").that.is.empty;
            });
        });
    });
});
