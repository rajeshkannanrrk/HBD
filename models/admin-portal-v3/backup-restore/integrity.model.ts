import * as mainModel from "../main.model";
const crypto = require('crypto');

const algorithm = "aes-256-ctr";

export async function encrypt(text) {
    const secret = await mainModel.kvService.getSecret(`portalbackupsecret`);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, crypto.scryptSync(secret, 'salt', 32), iv);
    let crypted = cipher.update(text, "utf8", "binary");
    crypted += cipher.final("binary");
    return iv.toString('binary') + crypted;
}

export async function decryptOldVersions(text) {
    // eslint-disable-next-line node/no-deprecated-api
    const decipher = crypto.createDecipher(algorithm, (await mainModel.kvService.getSecret("portalbackupsecret")));
    let dec = decipher.update(text, "binary", "utf8");
    dec += decipher.final("utf8");
    return dec;
}


export async function decrypt(text) {
    const iv = text.substr(0, 16);
    text = text.substr(16);
    const secret = await mainModel.kvService.getSecret(`portalbackupsecret`);
    const decipher = crypto.createDecipheriv(algorithm, crypto.scryptSync(secret, 'salt', 32), Buffer.from(iv, 'binary'));

    let dec = decipher.update(text, "binary", "utf8");
    dec += decipher.final("utf8");
    return dec;
}
