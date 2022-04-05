import * as fs from "fs";
import { promisify } from "util";
import * as path from "path";
import * as supertest from "supertest";
import { login, toggleSysAdminMode, users } from "./loginService";
import { app } from "../app";
import { tenantName } from "./consts";

const readFile = promisify(fs.readFile);

describe("Analytics - Conversation Trails", function () {
    this.timeout(10000);

    describe("GET /export", () => {
        const endpoint = `/account/${tenantName}/analytics/conversation-logs/export`;

        let expectedAllTrails = "";
        let expectedEndUserTrails = "";

        before(async () => {
            expectedAllTrails = await (await readFile(path.join(__dirname, "fixtures", "expectedAllTrails.csv"))).toString();
            expectedEndUserTrails = await (await readFile(path.join(__dirname, "fixtures", "expectedEndUserTrails.csv"))).toString();
        });

        [
            [users.editor, "editor"] as const,
            [users.reader, "reader"] as const
        ].forEach(([user, role]) => {
            it(`should fail when user role is ${role}`, async () => {
                const agent = supertest.agent(app);
    
                await login(user, agent);
    
                await agent
                    .get(endpoint)
                    .expect(403, "Editors and Readers are not allowed for this operations");
            });
        });

        it("should fail when user is sys admin in read only mode", async () => {
            const agent = supertest.agent(app);

            await login(users.sysAdmin, agent);

            await agent
                .get(endpoint)
                .expect(403, "System Admin in read only mode");
        });

        [
            [users.admin, "admin"] as const,
            [users.sysAdmin, "sys admin in write mode"] as const
        ].forEach(([user, role]) => {
            it(`should fail when there is no start date and user is ${role}`, async () => {
                const agent = supertest.agent(app);
    
                await login(user, agent);

                user === users.sysAdmin && await toggleSysAdminMode(agent);
    
                await agent
                    .get(endpoint)
                    .query({
                        endDate: (new Date()).valueOf().toString()
                    })
                    .expect(500);
            });

            it(`should fail when there is no end date and user is ${role}`, async () => {
                const agent = supertest.agent(app);
    
                await login(user, agent);

                user === users.sysAdmin && await toggleSysAdminMode(agent);
    
                await agent
                    .get(endpoint)
                    .query({
                        startDate: (new Date()).valueOf().toString()
                    })
                    .expect(500);
            });

            it(`should fail when start date is bigger than end date and user is ${role}`, async () => {
                const agent = supertest.agent(app);
    
                await login(user, agent);

                user === users.sysAdmin && await toggleSysAdminMode(agent);

                const now = new Date();
    
                await agent
                    .get(endpoint)
                    .query({
                        startDate: now.valueOf().toString(),
                        endDate: (new Date(now.valueOf()).setDate(now.getDate() - 1)).valueOf().toString()
                    })
                    .expect(500);
            });

            it(`should return a csv with logs from all users when user is ${role}`, async () => {
                const agent = supertest.agent(app);
    
                await login(user, agent);

                user === users.sysAdmin && await toggleSysAdminMode(agent);

    
                await agent
                    .get(endpoint)
                    .query({
                        startDate: (new Date(2021, 7, 1)).valueOf().toString(),
                        endDate: (new Date(2021, 9, 1)).valueOf().toString()
                    })
                    .expect(200, expectedAllTrails)
                    .expect("content-type", /csv/);
            });

            it(`should return a csv with logs from a specific end user when end user id is passed and user is ${role}`, async () => {
                const agent = supertest.agent(app);
    
                await login(user, agent);

                user === users.sysAdmin && await toggleSysAdminMode(agent);

    
                await agent
                    .get(endpoint)
                    .query({
                        startDate: (new Date(2021, 7, 1)).valueOf().toString(),
                        endDate: (new Date(2021, 9, 1)).valueOf().toString(),
                        userId: "6d9e76c2-1d1e-46a8-a5e8-301a618f8b71"
                    })
                    .expect(200, expectedEndUserTrails)
                    .expect("content-type", /csv/);
            });
        });
    });
});
