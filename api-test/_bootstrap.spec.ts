import "dotenv/config";
import { Logger } from "healthbotcommon/logger";
import { appReady } from "../app";

before(async function () {
    this.timeout(60000);

    Logger.setLogLevel("error");

    await appReady;
});
