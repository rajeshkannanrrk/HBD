import {Logger} from 'healthbotcommon/logger';
const logger = Logger.getInstance();

import * as portalHandlers from "./subscriptionHandlers";

interface IMessageBroker {
    createTopicIfNotExists: (topicName: string) => Promise<void>;
    createSubscriptionToTopic: (topicName: string) => Promise<void>;
    assignHandlerToSubscribedTopic: (topicName: string, handler: ((message: string) => Promise<void>)) => Promise<void>;
}

export class MessageBrokerEventsHandlerManager {
    private messageBroker: IMessageBroker;
    private topic: string;
    private events = {};

    public constructor(messageBroker, topic) {
        this.messageBroker = messageBroker;
        this.topic = topic;
    }

    public async init() {
        await this.messageBroker.createTopicIfNotExists(this.topic);
        await this.messageBroker.createSubscriptionToTopic(this.topic);
    }

    public async listen(){
        await this.messageBroker.assignHandlerToSubscribedTopic(this.topic, async (message: string) => {
            let messageObj: any;
            try {
                messageObj = JSON.parse(message);
            }
            catch (err) {
                logger.error(null, `Error occurred when parsing json. \n\n Error: ${err.message}. \n\n JSON: ${message}`);
            }
            if (messageObj && messageObj.customProperties.name in this.events) {
                this.events[messageObj.customProperties.name](messageObj.body);
            }
            else {
                logger.error(null, `${messageObj.customProperties.name} was not defined as an event.`);
            }
        });
    }

    public addEventHandler(eventName: portalHandlers.EventsNames, handler: (body: string) => any){
        this.events[eventName] = handler;
    }
}
