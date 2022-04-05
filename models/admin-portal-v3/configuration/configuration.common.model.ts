export function getValueByPath(obj, path){
    let res = obj;
    const split = path.split('.');
    while (res && split.length > 0) {
        res = res[split.shift()];
    }
    return res;
}

export function setValueByPath(obj, path, value){
    const split = path.split('.');
    const valueKey = split.pop();
    let target = obj;
    for (const key of split) {
        if (!target[key] || typeof target[key] !== "object") {
            target[key] = {};
        }
        target = target[key];
    }
    target[valueKey] = value;
    return obj;
}

export function cleanUndefinedFields(obj) {
    if (obj === undefined || obj === null || Array.isArray(obj) || typeof obj !== "object") {
        return obj;
    }
    for (const key of Object.keys(obj)) {
        if (obj[key] === undefined || obj[key] === null) {
            delete obj[key];
        }
        else if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
            obj[key] = cleanUndefinedFields(obj[key]);
            if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
            }
        }
    }
    return obj;
}
