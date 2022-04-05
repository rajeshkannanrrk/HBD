// const monacoJSFhirDefinition = require('../../tools/fhir/output/monaco.js-editor.json');
let monacoJSFhirDefinition = require('../../../tools/fhir/output/monaco.js-editor.json');
const monacoJSFhirDefinitionArr = [];
Object.keys(monacoJSFhirDefinition.interfaces).forEach((key) => {
    JSON.parse(monacoJSFhirDefinition.interfaces[key]).forEach((def) => {
        monacoJSFhirDefinitionArr.push(def);
    });
});
monacoJSFhirDefinition = null;
const api = require('../../../tools/fhir/output/fhir.api.json');
const resources = require('../../../tools/fhir/output/fhir.resources.json');

export function getFhirDefinitions(targetResourceName = null) {
    // const res = [];
    // const neededResources = [targetResourceName];
    // const usedResources = {};
    // while (neededResources.length > 0) {
    //     const resourceName = neededResources.pop();
    //     if (!usedResources[resourceName]) {
    //         usedResources[resourceName] = true;
    //         res.push(monacoJSFhirDefinition.interfaces[resourceName]);
    //         for (const neededResource of Object.keys(monacoJSFhirDefinition.recursionDef[resourceName])) {
    //             neededResources.push(neededResource.split('/')[1]);
    //         }
    //     }
    // }
    // return JSON.stringify(res);
    return monacoJSFhirDefinitionArr;
}

export function getFHIR3Definitions() {
    return {api, resources};
}

export const privateFunctions = {};
