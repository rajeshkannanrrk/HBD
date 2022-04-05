import { expect } from "chai";

export function expectLocalizationObject(obj: any): void {
    expect(obj).to.be.an("Object");
    expect(obj.locales).to.be.an("Array");
    expect(obj.stringIds).to.be.an("Array");
    if (obj.stringIds.length) {
        expect(obj).to.have.keys([...obj.locales, "locales", "stringIds"]);
    }
}
