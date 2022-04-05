/* eslint no-console: 0 */


import fs = require('fs');
const scheme = require('./sources/fhir.scheme');

const resourceList = scheme.definitions.ResourceList;
delete scheme.definitions.ResourceList;
const resources = Object.keys(scheme.definitions);
const dependencies = {};
const recursionDef: any = {};

const patterns = {};
// create descriptions
const schemas: any = {};

resourceList.oneOf.forEach((item) => {
    item.$ref = item.$ref.replace('#/definitions/', 'definition/');
});
schemas.ResourceList = {
    uri: "definition/ResourceList",
    fileMatch: ["definition/ResourceList"],
    schema: {
        type: "object",
        oneOf: resourceList.oneOf.map((item) => item.$ref.replace('#/definitions/', 'definition/'))
    }
};

for (const  resourceName of resources) {
    recursionDef[resourceName] = {};
    const def = scheme.definitions[resourceName];
    const schemaObject = {
        uri: "definition/" + resourceName,
        fileMatch: ["definition/" + resourceName],
        schema: {
            type: "object",
            properties: {},
            required: []
        }
    };

    dependencies[resourceName] = [];
    for (const part of def.allOf) {
        if (part.$ref) {
            if (part.$ref.startsWith("#/definitions/")) {
                const neededResourceName = part.$ref.replace('#/definitions/', '');
                dependencies[resourceName].push(neededResourceName);
            }
            else {
                console.log('dependency to handle - ' + resourceName + ' : ' + part.$ref);
            }
        }
        else if (part.properties) {
            if (part.required) {
                for (const requiredFieldName of part.required) {
                    schemaObject.schema.required.push(requiredFieldName);
                }
            }
            for (const propertyName of Object.keys(part.properties)) {
                const property = part.properties[propertyName];
                schemaObject.schema.properties[propertyName] = {
                    description: property.description
                };
                delete property.description; // TODO: use field descriptions as information
                if (property.$ref) {
                    if (property.$ref.startsWith('#/definitions/')) {
                        const referenceResourceName = property.$ref.replace('#/definitions/', 'definition/');
                        recursionDef[resourceName][referenceResourceName] = true;
                        schemaObject.schema.properties[propertyName].$ref = referenceResourceName;
                    }
                    else {
                        console.log('what is this dependency - ' + property.$ref); // TODO: fix the gaps
                    }
                }
                else if (property.type) {
                    if (property.type === 'boolean') {
                        if (Object.keys(property).length === 1) {
                            schemaObject.schema.properties[propertyName].type = "boolean";
                        }
                        else {
                            console.log('unhandled boolean - ' + JSON.stringify(property));
                        }
                    }
                    else if (property.type === 'number') {
                        if (property.pattern) {
                            patterns[property.pattern] = true;
                            delete property.pattern; // TODO: handle number patterns
                        }
                        if (Object.keys(property).length === 1) {
                            schemaObject.schema.properties[propertyName].type = "number";
                        }
                        else {
                            console.log('unhandled number - ' + JSON.stringify(property));
                        }
                    }
                    else if (property.type === 'array') {
                        if (property.items) {
                            if (property.items.type) {
                                if (property.items.type === 'string') {
                                    schemaObject.schema.properties[propertyName].type = "array";
                                    schemaObject.schema.properties[propertyName].items = { type: "string" };
                                }
                                else if (property.items.type === 'number') {
                                    schemaObject.schema.properties[propertyName].type = "array";
                                    schemaObject.schema.properties[propertyName].items = { type: "number" };
                                }
                                else {
                                    console.log("array of type - " + property.items.type);
                                }
                            }
                            else if (property.items.$ref) {
                                if (property.items.$ref.startsWith("#/definitions/")) {
                                    schemaObject.schema.properties[propertyName].type = "array";
                                    const referenceResourceName = property.items.$ref.replace("#/definitions/", "definition/");
                                    recursionDef[resourceName][referenceResourceName] = true;
                                    schemaObject.schema.properties[propertyName].items = { $ref: referenceResourceName };
                                }
                                else {
                                    console.log("array of other dependency - " + JSON.stringify(property.items.$ref));
                                }
                            }
                            else {
                                console.log('array of other definition - ' + JSON.stringify(property.items));
                            }
                        }
                        else {
                            console.log('unhandled type of array - ' + JSON.stringify(property));
                        }
                    }
                    else if (property.type === 'string') {
                        if (Object.keys(property).length === 1) {
                            schemaObject.schema.properties[propertyName].type = "string";
                        }
                        else if (property.pattern) {
                            schemaObject.schema.properties[propertyName].type = "string";
                            patterns[property.pattern] = true;
                        }
                        else if (property.enum) {
                            schemaObject.schema.properties[propertyName].enum = property.enum;
                        }
                        else {
                            console.log('unhandled string property - ' + JSON.stringify(property));
                        }
                    }
                    else {
                        console.log('unhandled  property type - ' + JSON.stringify(property.type));
                    }
                }
                else {
                    console.log('unhandled property - ' + JSON.stringify(property));
                }

                // finished creating definition

            }
        }
        schemas[resourceName] = schemaObject;
    }
}

let reasonableRoundsLeft = Object.keys(dependencies).length;

while (Object.keys(dependencies).length > 0 && reasonableRoundsLeft > 0) {
    reasonableRoundsLeft--;
    for (const targetResourceName of Object.keys(dependencies)) {
        if (dependencies[targetResourceName].length === 0) {
            // console.log('** ' + targetResourceName + ' completed ');
            delete dependencies[targetResourceName];
        }
        else {
            const unresolvedDependencies = [];
            for (const sourceResourceName of dependencies[targetResourceName]) {
                if ((dependencies[sourceResourceName]) && (dependencies[sourceResourceName].length > 0)) {
                    unresolvedDependencies.push(sourceResourceName);
                }
                else {
                    for (const addedProperty of Object.keys(schemas[sourceResourceName].schema.properties)) {
                        schemas[targetResourceName].schema.properties[addedProperty] = schemas[sourceResourceName].schema.properties[addedProperty];
                    }
                    for (const requiredProperty of schemas[sourceResourceName].schema.required) {
                        schemas[targetResourceName].schema.required = schemas[sourceResourceName].schema.required;
                    }
                }
            }
            dependencies[targetResourceName] = unresolvedDependencies;
        }
    }
}
recursionDef.ResourceList = [];
const interfaces: any = {};
if (Object.keys(dependencies).length > 0) {
    console.error("cannot resolve all dependencies");
    console.error(JSON.stringify(dependencies));
}
else {
    for (const resourceName of Object.keys(schemas)) {
        const types = [];
        if (resourceName === 'ResourceList') { continue; }
        const res = [];
        const resourceDefinition = schemas[resourceName];
        res.push('interface I' + resourceName + ' {');
        for (const propertyName of Object.keys(resourceDefinition.schema.properties)) {
            const propertyDefinition = resourceDefinition.schema.properties[propertyName];
            res.push('   /** ' + propertyDefinition.description + ' **/');
            const req = resourceDefinition.schema.required.filter((item) => item === propertyName);
            const name = (req.length > 0) ? propertyName : propertyName + '?';
            let defType;
            if (propertyDefinition.$ref) {
                defType = propertyDefinition.$ref.replace('definition/', 'I');
            }
            else if (propertyDefinition.type === 'array') {

                if (Array.isArray(propertyDefinition.items)) {
                    const items = [];
                    for (const item of propertyDefinition.items) {
                        if (item.$ref) {
                            items.push(item.$ref.replace('definition/', 'I'));
                        }
                        else if (item.type) {
                            items.push(item.type);
                        }
                        else {
                            console.log('what ??');
                        }
                        defType = '(' + items.join('|') + ')[]';
                    }
                }
                else {
                    if (propertyDefinition.items.$ref) {
                        defType = propertyDefinition.items.$ref.replace('definition/', 'I') + '[]';
                    }
                    else if (propertyDefinition.items.type) {
                        defType = propertyDefinition.items.type + '[]';
                    }
                    else {
                        console.log('what ??');
                    }
                }
            }
            else if (propertyDefinition.enum) {
                defType = "Type_" + resourceName + "_" + types.length;
                const newType = "type " + defType + " = \"" + propertyDefinition.enum.join("\" | \"") + "\";";
                types.push(newType);
            }
            else if (propertyDefinition.type === 'string') {
                defType = "string";
            }
            else if (propertyDefinition.type === 'number') {
                defType = "number";
            }
            else if (propertyDefinition.type === 'boolean') {
                defType = "boolean";
            }
            else {
                console.log('what ????');
            }
            res.push('   ' + name + ': ' + defType + ";");
        }
        res.push('}');
        types.forEach((defType) => {
            res.push(defType);
        });
        interfaces[resourceName] = JSON.stringify(res);
    }
}

const resourcesList = resourceList.oneOf.map((item) => item.$ref.replace("definition/", ""));
fs.writeFile('./output/fhir.resources.json', JSON.stringify(resourcesList), (err) => {
    if (err) {
        console.error("problem writing the resources output file", err);
    }
    else {
        console.log("ok 2");
    }
});

const objectForJavaScriptEditor = { interfaces, recursionDef };
const dataForJavaScriptEditor = JSON.stringify(objectForJavaScriptEditor, null, 4).replace(/IResourceList/g, "(" + + resourcesList.join('|') + ")");

fs.writeFile('./output/monaco.js-editor.json', dataForJavaScriptEditor, (err) => {
    if (err) {
        console.error("problem writing the resources output file", err);
    }
    else {
        console.log("ok 3");
    }
});
