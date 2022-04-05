import * as supertest from "supertest";

export function getXSRFToken(res: supertest.Response): string {
    return res
        .headers["set-cookie"]
        .map((cookie) => cookie.split(";").map((part) => part.trim()))
        .find(([cookie]) => cookie.split("=")[0].trim() === "XSRF-TOKEN")[0]
        .split("=")[1].trim();
}
