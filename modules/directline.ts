const rp = require('request-promise');

const DirectLineURL = 'https://directline.botframework.com/v3/directline';

/**
 * Generate DirectLine token from a secret. Token can be exposed to the user since it's has limited lifespan
 *
 * @param secret 
 */
export async function tokenFromSecret(secret: string): Promise<string> {
    const opt = {
        uri: `${DirectLineURL}/tokens/generate`,
        method: 'post',
        json: true,
        headers: {
            Authorization: 'Bearer ' + secret
        }
    };
    const wcTokenResponse = await rp(opt);
    return wcTokenResponse.token;
}
