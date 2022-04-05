export class Logger {
    public static getInstance(): Logger {
        return this._instance;
    }

    public static setLogLevel(level: string) {
        return;
    }

    public static setAzureTransport(options: {}) {
        return;
    }

    private static _instance: Logger = new Logger();

    private client;

    private eventProperties;

    public constructor() {

        if (Logger._instance) {
            throw new Error("Error: Instantiation failed: Use Logger.getInstance() instead of new.");
        }
        Logger._instance = this;
    }

    /**
     * Logger
     */
    public debug(context: any, format: string, ...args) {
        return;
    }

    public warning(context: any, format: string, ...args) {
        return;
    }

    public info(context: any, format: string, ...args) {
        return;
    }

    public error(context: any, format: string, ...args) {
        return;
    }

    public exception(context: any, err: Error) {
        return;
    }

    public event(context: any, name: string) {
        return;
    }

    private getLogContext(context: any) {
        return;
    }

    private formatMessage(format: string, args): string {
        return "";
    }
}
