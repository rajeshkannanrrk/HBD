import { ConfigurationPageModel } from "../../configuration/configuration.page.model";

const name = "Conversation > Human Handoff";
const mapping = {
    enable: "handoff.enable",
    userTimeout: "handoff.user_expiry_time_in_minutes",
    agentTimeout: "handoff.agent_expiry_time_in_minutes",
    teams: {
        tenantId: "handoff.teams.tenantId",
        groupObjectId: "handoff.teams.groupObjectId",
        clientId: "handoff.teams.clientId",
        clientSecret: "handoff.teams.clientSecret",
        organizerObjectId: "handoff.teams.organizerObjectId",
    },
    omnichannel: {
        bridge: "handoff.omnichannel.bridge"
    },
    agentMessages: {
        waiting: "handoff.agentMessages.waiting",
        cancellation: "handoff.agentMessages.cancellation",
        timeout: "handoff.agentMessages.timeout",
        agentConnection1: "handoff.agentMessages.agentConnection1",
        agentConnection2: "handoff.agentMessages.agentConnection2",
        endConversation: "handoff.agentMessages.endConversation",
        noAvailableAgents: "handoff.agentMessages.noAvailableAgents",
        connectionError: "handoff.agentMessages.connectionError"
    }
};

function customValidator(updatedDate: any, assert: (condition: boolean, msg: string) => void) {
    // TODO: add custom validator if needed
    return;
}

export const ConfigurationConversationHandoff = new ConfigurationPageModel(name, mapping, customValidator);
