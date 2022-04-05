import * as config from "config";
import * as jwt from "jsonwebtoken";
import * as nock from "nock";
import * as supertest from "supertest";
import { tenantId, tenantName } from "./consts";

const [authProtocol, authHostAndPath] = config.get<string>("auth.windowslive.token_uri").split("://");
const [authHost, ...authTokenPathParts] = authHostAndPath.split("/");
const authTokenPath = `/${authTokenPathParts.join("/")}`;

export interface User {
    name: string;
    preferred_username: string;
    roles: string[];
    tid: string;
}

type UserType = "sysAdmin" | "admin" | "editor" | "reader";

export const users: Record<UserType, User> = {
    sysAdmin: {
        name: "Omer Dolev",
        preferred_username: "odolev@microsoft.com",
        roles: [],
        tid: "72f988bf-86f1-41af-91ab-2d7cd011db47"
    },
    admin: {
        name: "Admin",
        preferred_username: "admin@apitest.com",
        roles: [],
        tid: tenantId
    },
    editor: {
        name: "Editor",
        preferred_username: "editor@apitest.com",
        roles: [],
        tid: tenantId
    },
    reader: {
        name: "Reader",
        preferred_username: "reader@apitest.com",
        roles: [],
        tid: tenantId
    }
};

const authService = nock(`${authProtocol}://${authHost}`, { allowUnmocked: true });
const graphService = nock("https://graph.microsoft.com", { allowUnmocked: true });

graphService
    .get(`/v1.0/groups/${config.get('auth.windowslive.sysadmins-sg-objid')}/members`)
    .reply(200, {
        value: [{ userPrincipalName: users.sysAdmin.preferred_username }]
    })
    .persist();

export async function login(user: User, agent: supertest.SuperAgentTest): Promise<supertest.Response> {
    const id_token = jwt.sign(user, "secret");

    authService
        .post(authTokenPath)
        .reply(200, {
            access_token: "access token",
            id_token,
            token_type: "bearer"
        });

    await agent
        .get(`/account/${tenantName}`)
        .expect(302);

    return agent
        .get(`/auth/windowslive/callback?code=12345&state=/account/${tenantName}`)
        .expect(302)
        .expect("location", `/account/${tenantName}`);
}

export function toggleSysAdminMode(agent: supertest.SuperAgentTest): Promise<supertest.Response> {
    return agent
        .get(`/account/${tenantName}/sysadminReadonly/toggle`)
        .expect(200, "false");
}
