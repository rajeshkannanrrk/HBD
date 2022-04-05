import * as config from 'config';
import { IHandyRedis } from 'handy-redis';
import * as redisClientManager from 'healthbotcommon/redisClientManager';
import * as redis from 'redis';

export let redisClient: redis.RedisClient;
export let handyRedisClient: IHandyRedis;

const redisConfig: any = config.get('redis');
const mergedConfig: any = { ...redisConfig.common, ...redisConfig.portal };

export async function init(): Promise<void> {
    redisClient = await createPrivateClient();
    handyRedisClient = redisClientManager.createHandyRedisClient(redisClient, mergedConfig);
}
/*
    create a new instance only in cases where using the shared instance (redisClient) causes issues.
    e.g. in pub/sub mechanism you can't pub and sub with the same client.
 */
export async function createPrivateClient(enableOfflineQueue = false): Promise<redis.RedisClient> {
    return redisClientManager.createClient(mergedConfig, enableOfflineQueue);
}
