var format = require('util').format;
var settings = {};

function endsWith(str, pattern) {
    var d = str.length - pattern.length;
    return d >= 0 && str.indexOf(pattern, d) === d;
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
    exports.getURL = function(options) {
        options = options || {};

        options.base = options.base || '';
        // Remove closing slashe
        options.base = options.base.replace(/\/$/, '');

        options.controller = options.controller || settings.defaultController;
        options.action = options.action || settings.defaultAction;
        options.params = options.params || '';
        if (Array.isArray(options.params)) {
            options.params = options.params.join('/');
        }
        // Remove leading and closing slashes
        options.params = options.params.replace(/^\//, '').replace(/\/$/, '');
        options.params = options.params != '' ? '/' + options.params : '';
        if (settings.i18n) {
            options.language = (options.language ? options.language : settings.defaultLanguage) + '/';
        } else {
            options.language = ''
        }
        options.suffix = typeof options.suffix == 'undefined' ? true : options.suffix;
        options.suffix = options.suffix ? settings.suffix : '';

        var defaultURL = format('%s/%s%s/%s%s',
            options.base,
            settings.i18n ? options.language : '',
            settings.defaultController,
            settings.defaultAction,
            options.suffix
        );
        var url = format('%s/%s%s/%s%s%s',
            options.base,
            options.language,
            options.controller,
            options.action,
            options.params,
            options.suffix
        );
        return defaultURL == url ? format('%s/%s', options.base, options.language) : url;
    }

    // Load controllers
    var list = [],
        rootPath = path.join(process.cwd(), settings.controllerDir);

    try {
        list = fs.readdirSync(rootPath);
    } catch (e) {}

    list.forEach(function (ctrl) {
        var name = path.basename(ctrl, path.extname(ctrl));
        controllers[name] = exports[name] = require(path.join(rootPath, ctrl));
        for (var i in settings.inject) {
            if (!settings.inject.hasOwnProperty(i)) {
                continue;
            }
            controllers[name][i] = settings.inject[i];
        }
    });

    app.all('*', function (request, response, next) {
        var language,
            controller = request.param('controller', settings.defaultController),
            action = request.param('action', settings.defaultAction),
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
            language = request.param('language', settings.defaultLanguage);
            if (params[0] && settings.languages.indexOf(params[0]) != -1) {
                language = params.shift();
            } else {
                language = settings.defaultLanguage;
            }
        }

        // controller
        if (params[0]) {
            controller = params.shift();
        }
        if (typeof controllers[controller] == 'undefined') {
            // controller doesn't exist
            next();
            return;
        }
    
        // action
        if (params[0]) {
            action = params.shift();
        }
        if (typeof controllers[controller][action] == 'undefined') {
            // action doesn't exist
            next();
            return;
        }

        controllers[controller].request = request;
        controllers[controller].response = response;
        controllers[controller].next = next;
        response.locals.controller = controller;
        response.locals.action = action;
        if (settings.i18n) {
            response.locals.language = language;
            controllers[controller].language = language;
        }
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

exports.delegate = function (ctrl, action) {
    return function (request, response, next) {
        ctrl.request = request;
        ctrl.response = response;
        ctrl.next = next;
        if (settings.i18n) {
            var params = request.url.replace(/^\//, '').replace(/\/$/, ''),
                language = params === settings.defaultLanguage ? [] : params.split('/')[0];

            if (settings.languages.indexOf(language) == -1) {
                language = settings.defaultLanguage;
            }

            ctrl.language = language;
        }
        try {
            ctrl[action].apply(ctrl);
        } catch (e) {
            if (settings.debug) {
                console.log(e.stack.toString());
                response.end(e.stack.toString());
            }
        }
    };
};
