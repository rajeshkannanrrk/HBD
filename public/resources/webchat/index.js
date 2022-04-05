const defaultLocale = 'en-US';

function extractLocale(localeParam) {
    if (!localeParam) {
        return defaultLocale;
    }
    else if (localeParam === 'autodetect') {
        return navigator.language;
    }
    else {
        return localeParam;
    }
}

function isValidLocale(locale){
    return typeof locale == 'string' && locale.split('-').length === 2;
}

function initBotConversation() {
    const params = new URLSearchParams(location.search);
    const locale = extractLocale(params.get('locale'));

    if (isValidLocale(locale)){
        document.documentElement.setAttribute("lang", locale.split('-')[0]);
    }

    const botConnection = window.WebChat.createDirectLine({
        token: params.get('t'),
        secret: params.get('s'),
        domain: params.get('domain')
    });
    const styleOptions = {
        botAvatarInitials: 'Bot',
        bubbleFromUserTextColor: 'White',
        bubbleFromUserBackground: 'Black'
    };

    const store = window.WebChat.createStore({}, function(store) { return function(next) { return function(action) {
        if (action.type === 'DIRECT_LINE/INCOMING_ACTIVITY') {
            // Listen to debugger events and notify the parent page (scenario editor)
            if (action.payload.activity.type === "event") {
                parent.postMessage(action.payload.activity, "*");
            }
        }
        return next(action);
    }}});
    window.addEventListener("message", function(event) {
        if (event.data.action==="runScenario") {
            store.dispatch({
                type: 'DIRECT_LINE/POST_ACTIVITY',
                meta: {method: 'keyboard'},
                payload: {
                    activity: {
                        type: "invoke",
                        name: "InitConversation",
                        locale: locale,
                        value: {
                            triggeredScenario: {
                                trigger: event.data.scenario_id,
                                args: event.data.args
                            }
                        }
                    }
                }
            });
        }
    } , false);
    const webchatOptions = {
        directLine: botConnection,
        styleOptions: styleOptions,
        store: store,
        userID: params.get('userId'),
        locale: locale,
        webSpeechPonyfillFactory: window.WebChat.createBrowserWebSpeechPonyfillFactory()
    };
    startChat(webchatOptions);
}

function startChat(webchatOptions) {
    const botContainer = document.getElementById('webchat');
    window.WebChat.renderWebChat(webchatOptions, botContainer);
    document.querySelector('#webchat > *').focus();
}
