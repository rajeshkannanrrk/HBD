import { URL } from "url";
import { expect } from "chai";

export function expectUrlNotToContainSasToken(url: string): void {
    const parsedUrl = new URL(url);

    expect([...parsedUrl.searchParams.keys()]).not.to.include("sig");
}
