var ThenFail = require('../../bld/thenfail.js');

var Promise = ThenFail.Promise;

module.exports = {
    deferred: function () {
        var promise = new Promise();
        return {
            promise: promise,
            resolve: function (value) {
                promise.resolve(value);
            },
            reject: function (reason) {
                promise.reject(reason);
            }
        };
    }
};