exports.init = function (app, opts) {
    var opts = opts || {},
        path = require('path'),
        fs = require('fs'),
        settings = {},
        controllers = {};
        defaults = {
            controllerDir: 'controllers',
            defaultController : 'main',
            defaultAction : 'index',
            debug: false
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
        controllers[name] = require(path.join(rootPath, ctrl));
    });

    app.all('/:controller?/:action?/?*', function(request, response, next) {
        var controller = request.param('controller', settings.defaultController),
            action = request.param('action', settings.defaultAction);
            params = request.param(0).split('/');

        if (params[params.length - 1] === '') {
            // Remove closing slash
            params = params.slice(0, params.length - 1);
        }
        // check controller
        if (typeof controllers[controller] == 'undefined') {
            params.unshift(action);
            action = controller;
            controller = settings.defaultController;
        }
        if (typeof controllers[controller] == 'undefined') {
            // controller doesn't exist
            next();
            return;
        }
        // check action
        if (typeof controllers[controller][action] == 'undefined') {
            params.unshift(action);
            action = settings.defaultAction;
        }
        if (typeof controllers[controller][action] == 'undefined') {
            // action doesn't exist
            next();
            return;
        }
        controllers[controller].request = request;
        controllers[controller].response = response;
        controllers[controller].next = next;
        try {
            controllers[controller][action].apply(controllers[controller], params);
        } catch (e) {
            if (settings.debug) {
                console.log(e.stack.toString());
                response.end(e.stack.toString());
            }
            response.end();
        }
    });
};