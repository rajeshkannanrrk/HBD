export interface IRequestUser {
    accessToken: string;
    customerServices: string[];
    displayName: string;
    emails: Array<{ value: string }>;
    expires: string;
    expires_in: number;
    refreshToken: string;
    strategy: string;
    sysadminsWriteMap: any;
    sysAdmins: string[];
    tenantID: string;
}
