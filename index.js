var format = require('util').format;
var settings = {};

function endsWith(str, pattern) {
    var d = str.length - pattern.length;
    return d >= 0 && str.indexOf(pattern, d) === d;
}

function delegate(ctrl, action) {
    return function (request, response, next) {
        try {
            ctrl[action].apply(ctrl, [request, response, next]);
        } catch (e) {
            if (settings.debug) {
                console.log(e.stack.toString());
                response.end(e.stack.toString());
            }
        }
    };
}

exports.init = function (app, opts) {
    opts = opts || {};

    var path = require('path'),
        fs = require('fs'),
        controllers = {},
        defaults = {
            controllerDir: 'controllers',
            defaultController : 'main',
            defaultAction : 'index',
            useMethod: false,
            suffix: '',
            debug: false,
            inject: {},
            i18n: false,
            defaultLanguage: 'en',
            languages: []
        };

    for (var p in defaults) {
        if (!defaults.hasOwnProperty(p)) {
            continue;
        }
        settings[p] = typeof opts[p] != 'undefined' ? opts[p] : defaults[p];
    }

    /**
     * Get site url
     * @param {String} base
     * @param {Object} options:
     *      base:       {String}           - Base url. Default is "/"
     *      language:   {String}           - Language part, if opts.i18n is set to true. Default is opts.defaultLanguage
     *      controller: {String}           - Controller part. Default is opts.defaultController
     *      action:     {String}           - Action part. Default is opts.defaultAction
     *      suffix:     {Boolean}          - Use suffix or not. Default is true
     *      params:     {String} | {Array} - Additional params
     */
    var getURL = exports.getURL = function (options) {
        options = options || {};

        options.base = options.base || '';
        // Remove closing slashe
        options.base = options.base.replace(/\/$/, '');

        options.controller = options.controller || settings.defaultController;
        options.params = options.params || '';
        if (options.params) {
            options.action = options.action || settings.defaultAction;
        } else {
            options.params = '';
            options.action = options.action || '';
        }
        options.controller += options.action ? '/' : '';
        
        if (Array.isArray(options.params)) {
            options.params = options.params.join('/');
        }
        // Remove leading and closing slashes
        options.params = options.params.replace(/^\//, '').replace(/\/$/, '');
        options.params = options.params !== '' ? '/' + options.params : '';
        if (settings.i18n) {
            options.language = (options.language ? options.language : settings.defaultLanguage) + '/';
        } else {
            options.language = '';
        }
        options.suffix = typeof options.suffix == 'undefined' ? true : options.suffix;
        options.suffix = options.suffix ? settings.suffix : '';

        var defaultURL = format('%s/%s%s%s%s',
            options.base, options.language, settings.defaultController,
            '', options.suffix
        );
        var url = format('%s/%s%s%s%s%s',
            options.base, options.language, options.controller,
            options.action, options.params, options.suffix
        );
        return defaultURL == url ? format('%s/%s', options.base, options.language) : url;
    };

    // Load controllers
    var list = [],
        rootPath = path.join(process.cwd(), settings.controllerDir);

    try {
        list = fs.readdirSync(rootPath);
    } catch (e) {}

    list.forEach(function (ctrl) {
        var name = path.basename(ctrl, path.extname(ctrl));
        controllers[name] = exports[name] = require(path.join(rootPath, ctrl));
        controllers[name].ctrl4x = exports;
        controllers[name].getURL = getURL;
        controllers[name].delegate = delegate;
        for (var i in settings.inject) {
            if (!settings.inject.hasOwnProperty(i)) {
                continue;
            }
            controllers[name][i] = settings.inject[i];
        }
    });

    app.all('*', function (request, response, next) {
        var language, controller, action,
            params = request.url
                // Remove leading and closing slashes
                .replace(/^\//, '')
                .replace(/\/$/, '');
        // Remove suffix
        if (endsWith(params, settings.suffix)) {
            params = params.substr(0, params.length - settings.suffix.length);
        }
        params = params === '' ? [] : params.split('/');
        // language
        if (settings.i18n) {
            if (params[0] && settings.languages.indexOf(params[0]) != -1) {
                language = params.shift();
                response.cookie('i18n', language);
            } else if (request.cookies.i18n && settings.languages.indexOf(request.cookies.i18n) != -1) {
                language = request.cookies.i18n;
            } else {
                language = settings.defaultLanguage;
            }
            // detect i18n module
            if (typeof response.setLocale == 'function') {
                response.setLocale(request, language);
                request.languages = settings.languages;
                response.locale = request.locale;
                response.locals.locale = request.locale;
            }
            response.language = language;
            response.locals.language = language;
            request.language = language;
        }

        // controller
        controller = params[0] ? params.shift() : settings.defaultController;
        if (typeof controllers[controller] == 'undefined') {
            // controller doesn't exist
            next();
            return;
        }
    
        // action
        action = params[0] ? params.shift() : settings.defaultAction;
        if (settings.useMethod) {
            var _action = action;
            switch (settings.useMethod) {
                case 'camelCase':
                    _action = request.method.toLocaleLowerCase() + action[0].toLocaleUpperCase() + action.substr(1);
                    break;
                case 'underscored':
                    _action = request.method.toLocaleLowerCase() + '_' + action;
                    break;
                case 'joined':
                    _action = request.method.toLocaleLowerCase() + action;
                    break;
                default:
                    break;
            }
            if (typeof controllers[controller][_action] != 'undefined') {
                action = _action;
            }
        }
        if (typeof controllers[controller][action] == 'undefined') {
            // action doesn't exist
            next();
            return;
        }

        request.controller = response.locals.controller = controller;
        request.action = response.locals.action = action;

        params.unshift(request, response, next);
        try {
            controllers[controller][action].apply(controllers[controller], params);
        } catch (e) {
            if (settings.debug) {
                console.log(e.stack.toString());
                response.end(e.stack.toString());
            }
        }
    });
};

exports.delegate = delegate;
