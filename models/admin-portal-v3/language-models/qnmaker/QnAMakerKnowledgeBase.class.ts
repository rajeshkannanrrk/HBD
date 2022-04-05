import {HealthBotUtils} from "healthbotcommon/healthbotutils";
import {Logger} from 'healthbotcommon/logger';
const logger = Logger.getInstance();
const rp = require("request-promise");

export interface IQnA {
    questions: string[];
    answer: string;
    source: string;
}

export interface IKnowledgeBaseDetails {
    id: string;
    name: string;
    hostName: string;
    sources: string[];
    urls: string[];
    userId: string;
}

export interface IKnowledgeBaseEndpointKeys {
    primaryEndpointKey: string;
    secondaryEndpointKey: string;
}

interface IOperationStatus {
    resourceLocation: string;
    operationState: string;
}

interface IQnAMakerKnowledgeBaseDetails {
    tenant: { id: string; name: string };
    subscriptionKey: string;
    endpoint?: string;
    qnas?: IQnA[];
    blobURIs?: string[];
    alterations?: string[];
}

export class QnAMakerKnowledgeBase {
    public context;
    public qnas: IQnA[];
    public blobURIs: string[];
    public kbid: string;
    public kbName: string;
    public subscriptionKey: string;
    public endpoint: string;
    public alterations: string[];

    public constructor(data: IQnAMakerKnowledgeBaseDetails) {
        this.context = {
            logContext: {
                tenant: data.tenant,
                model: "qnmaker.knowledgebase.model"
            }
        };
        this.qnas = data.qnas;
        this.blobURIs = data.blobURIs;
        this.subscriptionKey = data.subscriptionKey;
        this.endpoint = data.endpoint || "westus.api.cognitive.microsoft.com";
        this.alterations = data.alterations || [];
    }

    /**
     * API for creating this KB class instance
     */
    public async create(kbName: string): Promise<{details: IKnowledgeBaseDetails; endpointKeys: IKnowledgeBaseEndpointKeys}> {
        this.kbName = kbName;
        await this.createKnowledgeBase();
        try {
            await this.publishKnowledgeBase(this.kbid);
            const details = await this.getKBDetails(this.kbid);
            const endpointKeys = await this.getEndpointKeys();
            return {details, endpointKeys};
        } catch (e) {
            await this.rollbackKnowledgeBase();
            throw e;
        }
    }

    /**
     * API for updating the existing kb based on the used urls in the kb (generic)
     *
     * @param kbid
     * @param urls
     */
    public async updateKnowledgeBase(kbid, urls) {
        let createOperationResult;
        try {
            logger.debug(this.context, "QnA KB - Updating knowledge base started");
            const operation = await rp({
                url: `https://${this.endpoint}/qnamaker/v4.0/knowledgebases/${kbid}`,
                method: "patch",
                json: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                },
                body: { add: { urls }, update: { urls } }
            });
            createOperationResult = await this.pollingOperation(operation.operationId);
            if (createOperationResult.operationState !== "Succeeded") {
                throw new Error('Failed to update knowledge base');
            }
        }
        catch (e) {
            logger.debug(this.context, "QnA KB - Failed updating new knowledge base");
            throw e;
        }
    }

    /**
     * API for rollback this KB class instance after creation
     */
    public async rollbackKnowledgeBase(): Promise<void> {
        try {
            logger.debug(this.context, "QnA KB - deleting new knowledge base");
            await rp({
                url: `https://${this.endpoint}/qnamaker/v4.0/knowledgebases/${this.kbid}`,
                method: "delete",
                json: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                },
            });
        } catch (e) {
            logger.error(this.context, "QnA KB - Failed deleting knowledge base - " + e.message);
            throw e;
        }
    }

    /**
     * Creating the knowledge base
     */
    public async createKnowledgeBase(): Promise<void> {
        let createOperationResult: IOperationStatus;
        const body = {
            name: this.kbName,
            qnAList: undefined,
            urls: undefined
        };
        if (this.blobURIs) {
            body.urls = this.blobURIs;
        } else {
            body.qnAList = this.qnas.map((qna, id) => ({
                id,
                questions: qna.questions,
                answer: qna.answer,
                source: qna.source,
                metadata: []
            }));
        }
        try {
            logger.debug(this.context, "QnA KB - Creating new knowledge base");
            const operation = await rp({
                url: `https://${this.endpoint}/qnamaker/v4.0/knowledgebases/create`,
                method: "post",
                json: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                },
                body
            });
            createOperationResult = await this.pollingOperation(operation.operationId);
            if (createOperationResult.operationState !== "Succeeded") {
                throw new Error('Failed to create knowledge base');
            }

            this.kbid = createOperationResult.resourceLocation.split("/").pop();
        } catch (e) {
            logger.error(this.context, "QnA KB - Failed creating new knowledge base - " + e.message);
            throw e;
        }
    }

    /**
     * This method will replace knowledge base questions and answers
     */
    public async replaceKnowledgeBaseWithQnAs(kbid): Promise<void> {
        try {
            logger.debug(this.context, "QnA KB - Updating knowledge base");
            await rp({
                url: `https://${this.endpoint}/qnamaker/v4.0/knowledgebases/${kbid}`,
                method: "put",
                json: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                },
                body: {qnAList: this.qnas}
            });
        } catch (e) {
            logger.error(this.context, "QnA KB - Failed creating new knowledge base - " + e.message);
            throw e;
        }
    }

    /**
     * This method will publish a knowledge base
     */
    public async publishKnowledgeBase(kbid: string): Promise<void> {
        try {
            logger.debug(this.context, "QnA KB - Publishing knowledge base started");
            await rp({
                url: `https://${this.endpoint}/qnamaker/v4.0/knowledgebases/${kbid}`,
                method: "post",
                json: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                },
            });
            logger.debug(this.context, "QnA KB - Publishing knowledge completed");
        } catch (e) {
            logger.error(this.context, "QnA KB - Failed publishing knowledge base - " + e.message);
            throw e;
        }
    }

    /**
     * This method will return the knowledge base endpoint keys
     */
    public async getEndpointKeys(): Promise<IKnowledgeBaseEndpointKeys> {
        let endpointKeys: IKnowledgeBaseEndpointKeys;
        try {
            logger.debug(this.context, `QnA KB - Reading endpoint Keys`);
            endpointKeys = await rp({
                url: `https://${this.endpoint}/qnamaker/v4.0/endpointkeys`,
                method: "get",
                json: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                },
            });
        } catch (e) {
            logger.error(this.context, "QnA KB - Failed getting endpoint keys - " + e.message);
            throw e;
        }

        return endpointKeys;
    }

    /**
     * This method will return the knowledge base details
     */
    public async getKBDetails(kbid: string): Promise<IKnowledgeBaseDetails> {
        let details: IKnowledgeBaseDetails;
        try {
            logger.debug(this.context, `QnA KB - Reading knowledge base details`);
            details = await rp({
                url: `https://${this.endpoint}/qnamaker/v4.0/knowledgebases/${kbid}`,
                method: "get",
                json: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                },
            });
        } catch (e) {
            logger.error(this.context, "QnA KB - Failed getting knowledge base details - " + e.message);
            throw e;
        }
        details.hostName = `${details.hostName}/qnamaker`;

        return details;
    }

    /**
     * This method will perform polling on a create operation
     */
    public async pollingOperation(operationId: string): Promise<IOperationStatus> {
        let pollingResponse: IOperationStatus;
        try {
            do {
                await HealthBotUtils.sleep(2000);
                pollingResponse = await rp({
                    url: `https://${this.endpoint}/qnamaker/v4.0/operations/${operationId}`,
                    method: "get",
                    json: true,
                    headers: {
                        "Ocp-Apim-Subscription-Key": this.subscriptionKey
                    }
                });
                logger.debug(this.context, `QnA KB - Operation state = ${pollingResponse.operationState}`);
            } while (!pollingResponse || pollingResponse.operationState === "Running" || pollingResponse.operationState === "NotStarted");
        } catch (e) {
            logger.error(this.context, "QnA KB - Failed polling operation - " + e.message);
        }
        return pollingResponse;
    }

    public async getKnowledgeBases() {
        logger.debug(this.context, `Fetching knowledgebase list`);
        try {
            const data = await rp({
                url: `https://${this.endpoint}/qnamaker/v4.0/knowledgebases/`,
                method: "get",
                json: true,
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey
                }
            });
            return data.knowledgebases;
        }
        catch (e) {
            logger.error(this.context, "QnA KB - Failed fetching knowledgebase list - " + e.message);
            throw e;
        }
    }

}
