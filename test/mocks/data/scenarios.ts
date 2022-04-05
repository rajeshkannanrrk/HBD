
export const mockScenarioMetadata =
{
    name: "myscenario",
    id: "id",
    scenario_trigger: "trigger1",
    RowKey: "rowkey1",
    active: true
};

export const mockScenarioBlob = {
    steps: [{
        id: "25bd5e2b90ad-333abba6b35913da-453d",
        type: "prompt",
        dataType: "string",
        designer: {
            xLocation: 109,
            yLocation: 96
        },
        text: "How are you man?",
        variable: "das"
    }]
};

export const mockConfigBlob = {
    environment_variables: {
        beginable_builtin_dialogs: [
            '/builtin/somescenario'
        ]
    }
}

export const mockBlobService = {
    getBlobToText: (container: string) => {
        if (container == 'config') {
            return new Promise((resolve) => {
                resolve(JSON.stringify(mockConfigBlob));
            })
        }
        return new Promise((resolve) => {
            resolve(JSON.stringify(mockScenarioBlob));
        });
    },
    createContainerIfNotExists: (conatiner: string) : Promise<{}> => {
        return;
    },
    createBlockBlobFromText: (conatiner: string, blob: string): Promise<any> => {
        return;
    },
    deleteBlob: (container: string, blob: string): Promise<{}> => {
        return
    },
    doesBlobExist : (continer: string, blob: string) => {
        return true;
    },
    createBlobSnapshot: (continer: string, blob: string) => {
        return
    },
    listBlobsSegmentedWithPrefix(container: string) {
        if (container === "scenarios") {
            return new Promise((resolve) => {
                resolve(JSON.stringify(mockScenarioBlob));
            });
        }
        return;
    }
}

export const mocktTenantCosmosTableService = {
    retrieveEntity: async () => {
        return mockScenarioMetadata;
    },
    queryEntities: async () => {
        return [mockScenarioMetadata];
    },
    queryEntitiesWithContinuationToken: async () => {
        return { value: [mockScenarioMetadata] };
    },
    mergeEntity: async () => {

    },
    insertOrReplaceEntity: async () => {

    },
    createTableIfNotExists: async () => {

    },
    retrieveDeleteEntity: async () => {
        return mockScenarioMetadata;
    },
    executeBatch: async () => {

    }
}

export const mockTenantStorageTableService = {
    createTableIfNotExists: async () => {

    },
    insertOrReplaceEntity: async () => {
    }
}

