import * as mainModel from "../main.model";

export async function getSearchApiKey() {
    return mainModel.kvService.getSecret('scenariossearchapikey');
}
