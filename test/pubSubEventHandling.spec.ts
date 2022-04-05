
const stars = "\n********************************************************************\n";

import * as mockRequire from "mock-require";

mockRequire("healthbotcommon/tenantcontent", {
    tenantContentClientFactory: () => {}
});

import { expect } from "chai";
import * as sinon from "sinon";
import * as config from "config";
import { KeyVault } from "healthbotcommon/keyvault";
import * as globals from "../modules/globals";

// Loading AUT and related dependencies
import * as auth from "../modules/auth";
import * as subscriptionHandlers from "../modules/subscriptionHandlers";
import * as AUT from "../modules/messageBrokerEventsHandlerManager";

const kv = KeyVault.getInstance();

describe(stars + "Message broker events messaging" + stars, () => {
    let tenant;
    let portalEventHandler, eventHandler, rabbitManager;
    let topic = 'test-topic';
    let stubbedConfigGetter;
    let stubbedLoadTenantUsers;
    let message;
    let stubbedKvGetSecret: sinon.SinonStub;


    before((done) => {
        stubbedConfigGetter = sinon.stub(config, "get");
        stubbedLoadTenantUsers = sinon.stub(auth, "loadTenantUsersAsync");
        stubbedKvGetSecret = sinon.stub(kv, "getSecret");

        rabbitManager = {
            createSubscriptionToTopic: sinon.stub(),
            assignHandlerToSubscribedTopic: sinon.spy(),
            sendTopicMessage: sinon.stub(),
            createTopicIfNotExists: sinon.stub()
        };

        portalEventHandler = new AUT.MessageBrokerEventsHandlerManager(rabbitManager, topic);
        portalEventHandler.init().then( () => {
            portalEventHandler.addEventHandler(subscriptionHandlers.EventsNames.saveTenant, subscriptionHandlers.saveTenantHandler);
            portalEventHandler.addEventHandler(subscriptionHandlers.EventsNames.updateTenant, subscriptionHandlers.updateTenantHandler);
            portalEventHandler.addEventHandler(subscriptionHandlers.EventsNames.loadTenantUsers, subscriptionHandlers.loadTenantUsersHandler);
            portalEventHandler.addEventHandler(subscriptionHandlers.EventsNames.deleteTenant, subscriptionHandlers.deleteTenantHandler);
            portalEventHandler.listen().then(() => {
                eventHandler = rabbitManager.assignHandlerToSubscribedTopic.args[0][1];
                rabbitManager.sendTopicMessage.callsFake((arg1, message) => {
                    eventHandler(message);
                });
                done();
            });
        });
    });

    beforeEach(() => {
        // @ts-ignore
        globals.tenants = {};
        tenant = {
            tenantId: "12345678",
            email: "contosoTestTenantMail",
            name: "Contoso"
        };
    });

    it('deleteTenant event', async () => {
        globals.tenants[tenant.name] = tenant;
        message = {
            body: JSON.stringify(tenant),
            customProperties: {
                name: subscriptionHandlers.EventsNames.deleteTenant
            }
        };
        await rabbitManager.sendTopicMessage(topic, JSON.stringify(message));
        expect(tenant.name in globals.tenants).to.be.false;
    });

    it('saveTenant event', async () => {
        message = {
            body: JSON.stringify(tenant),
            customProperties: {
                name: subscriptionHandlers.EventsNames.saveTenant
            }
        };
        await rabbitManager.sendTopicMessage(topic, JSON.stringify(message));
        await new Promise((resolve) => setTimeout(resolve)); // Handler is async, so give it a chance to run
        expect(globals.tenants).to.have.key(tenant.name);
        expect(globals.tenantContents).to.have.key(tenant.name);
    });

    it('updateTenant event', async () => {
        globals.tenants[tenant.name] = tenant;
        const newTenant = {
            name: tenant.name,
            friendly_name: "",
            usermanagement: "",
            tenantid: "",
            email: "contosoTestNewTenantMail",
            planId: "",
            maxMessages: "",
            msgCount: ""
        };

        message = {
            body: JSON.stringify(newTenant),
            customProperties: {
                name: subscriptionHandlers.EventsNames.updateTenant
            }
        };
        await rabbitManager.sendTopicMessage(topic, JSON.stringify(message));
        expect(newTenant.email).to.equal(globals.tenants[tenant.name].email);
    });

    it('loadTenantUsers event', async () => {
        message = {
            body: JSON.stringify(tenant),
            customProperties: {
                name: subscriptionHandlers.EventsNames.loadTenantUsers
            }
        };
        await rabbitManager.sendTopicMessage(topic, JSON.stringify(message));
        expect(stubbedLoadTenantUsers.calledWith(tenant.tenantId)).to.be.true;
    });
});
