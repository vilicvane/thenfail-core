/**
 * ThenFail v0.3 Core
 * Just another Promises/A+ Library
 *
 * https://github.com/vilic/thenfail
 *
 * MIT License
 */
(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports"], function (require, exports) {
    /**
     * Possible states of a promise.
     */
    (function (State) {
        State[State["pending"] = 0] = "pending";
        State[State["fulfilled"] = 1] = "fulfilled";
        State[State["rejected"] = 2] = "rejected";
        State[State["interrupted"] = 3] = "interrupted";
    })(exports.State || (exports.State = {}));
    var State = exports.State;
    // The core abstraction of this implementation is to imagine the behavior of promises
    // as relay runners.
    //  1. Grab the baton state (and value/reason).
    //  2. Run and get its own state.
    //  3. Relay the new state to next runners.
    var Promise = (function () {
        function Promise(resolverOrContext) {
            var _this = this;
            this._state = 0 /* pending */;
            this._running = false;
            if (typeof resolverOrContext === 'function') {
                try {
                    resolverOrContext(function (value) { return _this.resolve(value); }, function (reason) { return _this.reject(reason); });
                }
                catch (error) {
                    this.reject(error);
                }
            }
        }
        /**
         * Get the state from previous promise in chain.
         */
        Promise.prototype._grab = function (previousState, previousValueOrReason) {
            if (this._state !== 0 /* pending */) {
                return;
            }
            var handler;
            if (previousState === 1 /* fulfilled */) {
                handler = this._onPreviousFulfilled;
            }
            else if (previousState === 2 /* rejected */) {
                handler = this._onPreviousRejected;
            }
            if (handler) {
                this._run(handler, previousValueOrReason);
            }
            else {
                this._relay(previousState, previousValueOrReason);
            }
        };
        /**
         * Invoke `onfulfilled` or `onrejected` handlers.
         */
        Promise.prototype._run = function (handler, previousValueOrReason) {
            var _this = this;
            this._running = true;
            setImmediate(function () {
                var ret;
                try {
                    ret = handler(previousValueOrReason);
                }
                catch (error) {
                    _this._relay(2 /* rejected */, error);
                    _this._running = false;
                    return;
                }
                _this._unpack(ret, function (state, valueOrReason) {
                    _this._relay(state, valueOrReason);
                    _this._running = false;
                });
            });
        };
        /**
         * The resolve process defined in Promises/A+ specifications.
         */
        Promise.prototype._unpack = function (value, callback) {
            var _this = this;
            if (this === value) {
                callback(2 /* rejected */, new TypeError('The promise should not return itself'));
            }
            else if (value instanceof Promise) {
                if (value._state === 0 /* pending */) {
                    if (value._handledPromise) {
                        value._handledPromises = [value._handledPromise, this];
                        value._handledPromise = undefined;
                    }
                    else if (value._handledPromises) {
                        value._handledPromises.push(this);
                    }
                    else {
                        value._handledPromise = this;
                    }
                }
                else {
                    callback(value._state, value._valueOrReason);
                }
            }
            else if (value) {
                switch (typeof value) {
                    case 'object':
                    case 'function':
                        try {
                            var then = value.then;
                            if (typeof then === 'function') {
                                then.call(value, function (value) {
                                    if (callback) {
                                        _this._unpack(value, callback);
                                        callback = undefined;
                                    }
                                }, function (reason) {
                                    if (callback) {
                                        callback(2 /* rejected */, reason);
                                        callback = undefined;
                                    }
                                });
                                break;
                            }
                        }
                        catch (e) {
                            if (callback) {
                                callback(2 /* rejected */, e);
                                callback = undefined;
                            }
                            break;
                        }
                    default:
                        callback(1 /* fulfilled */, value);
                        break;
                }
            }
            else {
                callback(1 /* fulfilled */, value);
            }
        };
        /**
         * Set the state of current promise and relay it to next promises.
         */
        Promise.prototype._relay = function (state, valueOrReason) {
            if (this._state !== 0 /* pending */) {
                return;
            }
            this._state = state;
            this._valueOrReason = valueOrReason;
            if (this._chainedPromise) {
                this._chainedPromise._grab(state, valueOrReason);
            }
            else if (this._chainedPromises) {
                for (var _i = 0, _a = this._chainedPromises; _i < _a.length; _i++) {
                    var promise = _a[_i];
                    promise._grab(state, valueOrReason);
                }
            }
            if (this._handledPromise) {
                this._handledPromise._relay(state, valueOrReason);
            }
            else if (this._handledPromises) {
                for (var _b = 0, _c = this._handledPromises; _b < _c.length; _b++) {
                    var promise = _c[_b];
                    promise._relay(state, valueOrReason);
                }
            }
            if (this._onPreviousFulfilled) {
                this._onPreviousFulfilled = undefined;
            }
            if (this._onPreviousRejected) {
                this._onPreviousRejected = undefined;
            }
            if (this._chainedPromise) {
                this._chainedPromise = undefined;
            }
            else {
                this._chainedPromises = undefined;
            }
            if (this._handledPromise) {
                this._handledPromise = undefined;
            }
            else {
                this._handledPromises = undefined;
            }
        };
        Promise.prototype.then = function (onfulfilled, onrejected) {
            var promise = new Promise();
            if (typeof onfulfilled === 'function') {
                promise._onPreviousFulfilled = onfulfilled;
            }
            if (typeof onrejected === 'function') {
                promise._onPreviousRejected = onrejected;
            }
            if (this._state === 0 /* pending */) {
                if (this._chainedPromise) {
                    this._chainedPromises = [this._chainedPromise, promise];
                    this._chainedPromise = undefined;
                }
                else if (this._chainedPromises) {
                    this._chainedPromises.push(promise);
                }
                else {
                    this._chainedPromise = promise;
                }
            }
            else {
                promise._grab(this._state, this._valueOrReason);
            }
            return promise;
        };
        /**
         * Resolve this promise with a value or thenable.
         * @param value A normal value, or a promise/thenable.
         */
        Promise.prototype.resolve = function (value) {
            var _this = this;
            this._unpack(value, function (state, valueOrReason) { return _this._grab(state, valueOrReason); });
        };
        /**
         * Reject this promise with a reason.
         */
        Promise.prototype.reject = function (reason) {
            this._grab(2 /* rejected */, reason);
        };
        /**
         * A shortcut of `Promise.then(() => value)`.
         * @return Return the value itself if it's an instanceof ThenFail Promise.
         */
        Promise.resolve = function (value) {
            if (value instanceof Promise) {
                return value;
            }
            else {
                var promise = new Promise();
                promise.resolve(value);
                return promise;
            }
        };
        Promise.reject = function (reason) {
            var promise = new Promise();
            promise.reject(reason);
            return promise;
        };
        return Promise;
    })();
    exports.Promise = Promise;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Promise;
});
//# sourceMappingURL=thenfail.js.map