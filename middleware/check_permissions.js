/**
 * Middleware для проверки прав на доступ к ресурсу.
 * В этом middleware идет только проверка на возможность доступа - можно/нельзя.
 */


/**
 * Возвращает одно из дефолтных действий в зависимости от http метода
 */
var getDefaultAction = function (method) {
    return {
        get: 'read',
        post: 'create',
        put: 'update',
        delete: 'delete'
    }[method];
};

function checkCheckUpdateParams(reqBody, permissions) {
    if (typeof permissions === 'boolean') {
        return permissions;
    }

    /**
     * Если permissions объект, в котором есть аттрибут except значит, пользователь может обновлять
     * все поля за исключением тех, которые указаны в expect. Поэтому проверим, если тело запроса
     * содержит хотябы одно поле из массива except в доступе нужно отказать.
     */
    if (permissions.hasOwnProperty('except')) {
        for (var key in reqBody) {
            if (reqBody.hasOwnProperty(key)) {
                if (permissions.except.indexOf(key) >= 0) {
                    return false;
                }
            }
        }
    return true;
    }

    /**
    * Если permissions объект, в котором есть аттрибут only значит, пользователь может обновлять
    * только поля, которые указаны в only. Поэтому проверим, если тело запроса
    * содержит хотябы одно поле не из массива only в доступе нужно отказать.
    */
    if (permissions.hasOwnProperty('only')) {
        for (var key in reqBody) {
            if (reqBody.hasOwnProperty(key)) {
                if (permissions.only.indexOf(key) < 0) {
                    return false;
                }
            }
        }
    return true;
    }
}


/**
 * Middleware для проверки прав
 */
module.exports = function (req, res, next) {
    var accessDenied = true,
        errMsg = 'AccessDenied';

    if (req.no_auth || !req.endpoint) {
        next();
        return;
    }

    var user = res.locals.profile;

    if (!user) {
        res.error('AccessDenied', 403);
        return;
    }

    if (!req.action) {
        req.action = getDefaultAction(req.method.toLowerCase());
    }

    if (user.permissions[req.endpoint] && user.permissions[req.endpoint][req.action]) {
        accessDenied = false;
    };

    if (req.route.path === '/users/:id' && (user._id === req.params.id)) {
        accessDenied = false;
    };

    /*
    if(req.user.client &&
      (req.method === 'GET' && req.route.path === '/clients/:id' && req.user.client.length > 0) ||
      req.params.client_id) {
    
        accessDenied = true;

        req.user.client.forEach(function (v, i, a) {
        if (req.params.id === v.uid.toString()) {
            accessDenied = false;
        }
        });

    if(req.user.place &&
        (req.method === 'GET' && req.route.path === '/places/:id' && req.user.place.length > 0) ||
        req.params.place_id) {
        
        accessDenied = true;

        req.user.place.forEach(function (v, i, a) {
        if (req.params.id === v.uid.toString()) {
            accessDenied = false;
        }
        });
    }
    
    if (req.method === 'PUT') {
        if (!checkCheckUpdateParams(req.body, req.token.permissions[endpoint][action])) {
            accessDenied = true;
            errMsg = 'UpdateRestrictedParamsError';
        }
    }
    */

    if (accessDenied) {
        res.error('AccessDenied', 403);
    } else {
        next();
    }
};