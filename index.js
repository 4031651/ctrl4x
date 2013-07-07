var settings = {};

exports.init = function (app, opts) {
    opts = opts || {};

    var path = require('path'),
        fs = require('fs'),
        controllers = {},
        defaults = {
            controllerDir: 'controllers',
            defaultController : 'main',
            defaultAction : 'index',
            debug: false,
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

    // Load controllers
    var list = [],
        rootPath = path.join(process.cwd(), settings.controllerDir);

    try {
        list = fs.readdirSync(rootPath);
    } catch (e) {}

    list.forEach(function (ctrl) {
        var name = path.basename(ctrl, path.extname(ctrl));
        controllers[name] = exports[name] = require(path.join(rootPath, ctrl));
    });

    app.all('*', function (request, response, next) {
        var language,
            controller = request.param('controller', settings.defaultController),
            action = request.param('action', settings.defaultAction),
            params = request.url
                .replace(/^\//, '')
                .replace(/\/$/, '');
        
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
        if (settings.i18n) {
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
