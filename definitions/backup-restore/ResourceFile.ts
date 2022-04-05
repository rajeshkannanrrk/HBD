const fs = require("fs");

export class ResourceFile{
    public name: string;
    public content: string;

    public static encode(file: string): string {
        const body = fs.readFileSync(file);
        return body.toString('base64');
    }

    public static decode(content: string): Buffer {
        return Buffer.from(content, 'base64');
    }
}
