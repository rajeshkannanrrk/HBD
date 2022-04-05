
export const eventProperties = {
    TenantAdded: ['eventId', 'tenantId', 'tenantName', 'region'],
    TenantTierChange: ['eventId', 'tenantId', 'tenantName', 'region', 'oldTier', 'newTier'],
    TenantDeleted: ['eventId', 'tenantId', 'tenantName', 'region'],
    PortalAction: ['eventId', 'tenantId', 'tenantName', 'region', 'action', 'target'],
    TemplateProvision: ['eventId', 'tenantId', 'tenantName', 'templateName', 'templateId', 'region']
};

export const eventTypes = {
    TENANT_ADDED: "TenantAdded",
    TENANT_TIER_CHANGE: "TenantTierChange",
    TENANT_DELETED: "TenantDeleted",
    PORTAL_ACTION: "PortalAction",
    TEMPLATE_PROVISION: "TemplateProvision"
};

export const portalActions = {
    PAGE_VIEW: "pageView"
};
