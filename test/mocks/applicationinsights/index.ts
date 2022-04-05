class ApplicationInsights {
    public static _isConsole = true;
    public static  _isExceptions = true;
    public static _isPerformance = true;
    public static _isRequests = true;
    public static _isDependencies = true;
    public static _isOfflineMode = false;
    public static _isStarted = false;
    public client = null;
    public _isStarted = false;

    public ApplicationInsights() {
        this.client = null;
        this._isStarted = false;
    }
    public getClient(instrumentationKey) {
        return {
            trackTrace: (a, b, c) => {
                return;
            }
        };
    }
    public setup(instrumentationKey) {
        // TODO: Mock this function
        return this;
    }
    public start() {
        // TODO: Mock this function
        this._isStarted = true;
        return this;
    }
    /**
     * Sets the state of console tracking (enabled by default)
     * @param value if true console activity will be sent to Application Insights
     * @returns {ApplicationInsights} this class
     */
    public setAutoCollectConsole(value) {
        // TODO: Mock this function
        return this;
    }
    /**
     * Sets the state of exception tracking (enabled by default)
     * @param value if true uncaught exceptions will be sent to Application Insights
     * @returns {ApplicationInsights} this class
     */
    public setAutoCollectExceptions(value) {
        // TODO: Mock this function
        return this;
    }
    /**
     * Sets the state of performance tracking (enabled by default)
     * @param value if true performance counters will be collected every second and sent to Application Insights
     * @returns {ApplicationInsights} this class
     */
    public setAutoCollectPerformance(value) {
        // TODO: Mock this function
        return this;
    }
    /**
     * Sets the state of request tracking (enabled by default)
     * @param value if true requests will be sent to Application Insights
     * @returns {ApplicationInsights} this class
     */
    public setAutoCollectRequests(value) {
        // TODO: Mock this function
        return this;
    }
    /**
     * Sets the state of dependency tracking (enabled by default)
     * @param value if true dependencies will be sent to Application Insights
     * @returns {ApplicationInsights} this class
     */
    public setAutoCollectDependencies(value) {
        // TODO: Mock this function
        return this;
    }
    /**
     * Enable or disable offline mode to cache events when client is offline (disabled by default)
     * @param value if true events that occured while client is offline will be cached on disk
     * @param resendInterval. The wait interval for resending cached events.
     * @returns {ApplicationInsights} this class
     */
    public setOfflineMode(value, resendInterval) {
        // TODO: Mock this function
        return this;
    }
    /**
     * Enables verbose debug logging
     * @returns {ApplicationInsights} this class
     */
    public enableVerboseLogging() {
        // TODO: Mock this function
        return this;
    }
    /**
     * Disposes the default client and all the auto collectors so they can be reinitialized with different configuration
     */
    public dispose() {
        // TODO: Mock this function
        this.client = null;
        this._isStarted = false;
        return this;
    }
}
module.exports = new ApplicationInsights();
