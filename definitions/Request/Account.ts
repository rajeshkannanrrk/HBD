export interface IAccount {
    app_id: string;
    app_secret: string;
    armGroup: string;
    blockSent: boolean;
    botName: string;
    domains: string;
    email: string;
    endsAt: string;
    friendly_name: string;
    id: string;
    logoURL: string;
    mail80Sent: boolean;
    mail100Sent: boolean;
    meterState: string;
    msgCount: number;
    msgExceeded: boolean;
    name: string;
    powerbi_report: string;
    saasSubscriptionId: string;
    sku: string;
    storage_account_name: string;
    storage_secret_name: string;
    subscriptionId: string;
    tenantid: string;
    unblockSent: boolean;
    usermanagement: string;
    webchat_secret: string;
    PartitionKey: string;
    RowKey: string;
    Timestamp: string;
    api_jwt_secret: string;
    customDomain: string;
    storageModelVersion?: "1" | "2"
}
