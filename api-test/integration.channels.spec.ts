import * as supertest from "supertest";
import * as nock from "nock";
import { tenantName } from "./consts";
import { getXSRFToken } from "./getXSRFToken";
import { users, login, toggleSysAdminMode } from "./loginService";
import { app } from "../app";
import { ARM_URL } from "../models/admin-portal-v3/integration/integration.channels.model";

describe("Integration - Channels", function () {
    this.timeout(60000);

    const filename = "icon.png";

    [
        [users.admin, "admin"] as const,
        [users.sysAdmin, "sys admin in write mode"] as const
    ].forEach(([user, userDescription]) => {
        it(`POST /botIcon/upload should create a resource with the requested icon when user is ${userDescription}`, async () => {
            const request = supertest.agent(app);
            const loginRes = await login(user, request);
            const armServer = nock(ARM_URL, { allowUnmocked: true });

            if (user === users.sysAdmin) {
                await toggleSysAdminMode(request);
            }
    
            const getResourcesRes = await request
                .get(`/account/${tenantName}/resources/files/all`)
                .expect(200);
    
            armServer
                .patch(new RegExp(tenantName), (body) => body.properties.iconUrl === `${getResourcesRes.body.blobUrl}/${filename}`)
                .reply(200);
    
            await request
                .post(`/account/${tenantName}/integration/channels/botIcon/upload`)
                .attach("icon", `api-test/fixtures/${filename}`)
                .set("xsrf-token", getXSRFToken(loginRes))
                .expect(200);
    
            await supertest(getResourcesRes.body.blobUrl)
                .get(`/${filename}`)
                .expect(200)
                .expect("content-type", "image/png")
                .expect("content-length", "3459")
                .expect("content-md5", "PvNlOBaPz31E3bEHe5R/Kg==");
    
            await request
                .delete(`/account/${tenantName}/resources/files/delete`)
                .query({ name: filename })
                .send({ _csrf: getXSRFToken(getResourcesRes) })
                .expect(200);
            
            armServer.done();
        });
    });

    [
        [users.editor, "editor"] as const,
        [users.reader, "reader"] as const
    ].forEach(([user, role]) => {
        it(`POST /botIcon/upload should return 403 when user is ${role}`, async () => {
            const request = supertest.agent(app);
            const loginRes = await login(user, request);

            await request
                .post(`/account/${tenantName}/integration/channels/botIcon/upload`)
                .attach("icon", `api-test/fixtures/${filename}`)
                .set("xsrf-token", getXSRFToken(loginRes))
                .expect(403, "Readers & Editors are not allowed for this operation");
        });
    });

    it("POST /botIcon/upload should return 403 when user is sys admin in read mode", async () => {
        const request = supertest.agent(app);
        const loginRes = await login(users.sysAdmin, request);

        await request
            .post(`/account/${tenantName}/integration/channels/botIcon/upload`)
            .attach("icon", `api-test/fixtures/${filename}`)
            .set("xsrf-token", getXSRFToken(loginRes))
            .expect(403, "System Admin in read only mode");
    });
});
