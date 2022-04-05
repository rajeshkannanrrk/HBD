import { AuthProvider, DataConnection, ScenarioBackupEntity, LocalizedString, SkillInfo } from "healthbotcommon/tenantcontent";
import { ResourceFile } from "./ResourceFile";

type OrString<T extends Record<any, any>, K extends keyof T> = {
    [k in keyof T]: k extends K ? T[k] | string : T[k]
};

export type DataConnectionBackupData = OrString<DataConnection, "static_parameters"> & { PartitionKey?: string, RowKey?: string };

export class BackupImageData {
    public configuration: any;
    public authenticationProviders: AuthProvider[];
    public dataConnections: DataConnectionBackupData[];
    public files: ResourceFile[];
    public localization: {
        system: LocalizedString[],
        custom: LocalizedString[]
    };
    public skills: SkillInfo[];
    public scenarios: ScenarioBackupEntity[];
}
