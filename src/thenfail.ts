/**
 * ThenFail v0.3 Core
 * Just another Promises/A+ Library
 * 
 * https://github.com/vilic/thenfail
 * 
 * MIT License
 */

export type ThenableOrValue<Value> = Promise<Value>|Thenable<Value>|Value;

/**
 * Promise like object.
 */
export interface Thenable<Value> {
    then<Return>(onfulfilled: (value: Value) => ThenableOrValue<Return>, onrejected: (reason: any) => any): Thenable<Return>;
}

export type Resolver<Value> = (
    resolve: (value?: ThenableOrValue<Value>) => void,
    reject: (reason: any) => void
) => void;

export type OnFulfilledHandler<Value, Return> = (value: Value) => ThenableOrValue<Return>;

export type OnRejectedHandler<Return> = (reason: any) => ThenableOrValue<Return>;

export type OnAnyHandler<Return> = (valueOrReason: any) => ThenableOrValue<Return>;

/**
 * Possible states of a promise.
 */
export const enum State {
    pending,
    fulfilled,
    rejected
}

// The core abstraction of this implementation is to imagine the behavior of promises
// as relay runners.
//  1. Grab the baton state (and value/reason).
//  2. Run and get its own state.
//  3. Relay the new state to next runners.

export class Promise<Value> implements Thenable<Value> {
    private _state = State.pending;
    private _running = false;
    private _valueOrReason: any;

    /** 
     * Next promises in the chain.
     */
    private _chainedPromise: Promise<any>;
    private _chainedPromises: Promise<any>[];

    /** 
     * Promises that will share the same state (and value/reason).
     * 
     * Example:
     *  
     *  let promiseA = Promise.then(() => {
     *      let promiseB = Promise.then(() => ...);
     *      return promiseB;
     *  });
     * 
     *  The state of `promiseB` will determine the state of `promiseA`.
     *  And `promiseA` will then be in here.
     */
    private _handledPromise: Promise<Value>;
    private _handledPromises: Promise<Value>[];
    
    private _onPreviousFulfilled: OnFulfilledHandler<any, Value>;
    private _onPreviousRejected: OnRejectedHandler<Value>;

    /**
     * Promise constructor.
     */
    constructor();
    constructor(resolver: Resolver<Value>);
    constructor(resolverOrContext?: Resolver<Value>) {
        if (typeof resolverOrContext === 'function') {
            try {
                (<Resolver<Value>>resolverOrContext)(
                    value => this.resolve(value),
                    reason => this.reject(reason)
                );
            } catch (error) {
                this.reject(error);
            }
        }
    }

    /**
     * Get the state from previous promise in chain.
     */
    private _grab(previousState: State, previousValueOrReason?: any): void {
        if (this._state !== State.pending) {
            return;
        }
        
        let handler: OnAnyHandler<ThenableOrValue<Value>>;
        
        if (previousState === State.fulfilled) {
            handler = this._onPreviousFulfilled;
        } else if (previousState === State.rejected) {
            handler = this._onPreviousRejected;
        }
        
        if (handler) {
            this._run(handler, previousValueOrReason);
        } else {
            this._relay(previousState, previousValueOrReason);
        }
    }

    /**
     * Invoke `onfulfilled` or `onrejected` handlers.
     */
    private _run(handler: OnAnyHandler<any>, previousValueOrReason: any): void {
        this._running = true;
        
        setImmediate(() => {
            let ret: ThenableOrValue<Value>;

            try {
                ret = handler(previousValueOrReason);
            } catch (error) {
                this._relay(State.rejected, error);
                this._running = false;
                return;
            }

            this._unpack(ret, (state, valueOrReason) => {
                this._relay(state, valueOrReason);
                this._running = false;
            });
        });
    }
    
    /**
     * The resolve process defined in Promises/A+ specifications.
     */
    private _unpack(value: ThenableOrValue<Value>, callback: (state: State, valueOrReason: any) => void): void {
        if (this === value) {
            callback(State.rejected, new TypeError('The promise should not return itself'));
        } else if (value instanceof Promise) {
            if (value._state === State.pending) {
                if (value._handledPromise) {
                    value._handledPromises = [value._handledPromise, this];
                    value._handledPromise = undefined;
                } else if (value._handledPromises) {
                    value._handledPromises.push(this);
                } else {
                    value._handledPromise = this;
                }
            } else {
                callback(value._state, value._valueOrReason);
            }
        } else if (value) {
            switch (typeof value) {
                case 'object':
                case 'function':
                    try {
                        let then = (<Thenable<any>>value).then;

                        if (typeof then === 'function') {
                            then.call(
                                value,
                                (value: any) => {
                                    if (callback) {
                                        this._unpack(value, callback);
                                        callback = undefined;
                                    }
                                },
                                (reason: any) => {
                                    if (callback) {
                                        callback(State.rejected, reason);
                                        callback = undefined;
                                    }
                                }
                            );

                            break;
                        }
                    } catch (e) {
                        if (callback) {
                            callback(State.rejected, e);
                            callback = undefined;
                        }

                        break;
                    }
                default:
                    callback(State.fulfilled, value);
                    break;
            }
        } else {
            callback(State.fulfilled, value);
        }
    }

    /**
     * Set the state of current promise and relay it to next promises.
     */
    private _relay(state: State, valueOrReason?: any): void {
        if (this._state !== State.pending) {
            return;
        }
        
        this._state = state;
        this._valueOrReason = valueOrReason;
        
        if (this._chainedPromise) {
            this._chainedPromise._grab(state, valueOrReason);
        } else if (this._chainedPromises) {
            for (let promise of this._chainedPromises) {
                promise._grab(state, valueOrReason);
            }
        }
        
        if (this._handledPromise) {
            this._handledPromise._relay(state, valueOrReason);
        } else if (this._handledPromises) {
            for (let promise of this._handledPromises) {
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
        } else {
            this._chainedPromises = undefined;
        }
        
        if (this._handledPromise) {
            this._handledPromise = undefined;
        } else {
            this._handledPromises = undefined;
        }
    }
    
    /**
     * The `then` method that follows Promises/A+ specifications <https://promisesaplus.com>.
     * To learn how to use promise, please check out <https://github.com/vilic/thenfail>.
     */
    then<Return>(onfulfilled: OnFulfilledHandler<Value, Return>, onrejected?: OnRejectedHandler<Return>): Promise<Return>;
    then(onfulfilled: void, onrejected: OnRejectedHandler<Value>): Promise<Value>;
    then(onfulfilled?: any, onrejected?: any): Promise<any> {
        let promise = new Promise<any>();
        
        if (typeof onfulfilled === 'function') {
            promise._onPreviousFulfilled = onfulfilled;
        }
        
        if (typeof onrejected === 'function') {
            promise._onPreviousRejected = onrejected;
        }
        
        if (this._state === State.pending) {
            if (this._chainedPromise) {
                this._chainedPromises = [this._chainedPromise, promise];
                this._chainedPromise = undefined;
            } else if (this._chainedPromises) {
                this._chainedPromises.push(promise);
            } else {
                this._chainedPromise = promise;
            }
        } else {
            promise._grab(this._state, this._valueOrReason);
        }
        
        return promise;
    }
    
    /**
     * Resolve this promise with a value or thenable.
     * @param value A normal value, or a promise/thenable.
     */
    resolve(value?: ThenableOrValue<Value>): void {
        this._unpack(value, (state, valueOrReason) => this._grab(state, valueOrReason));
    }
    
    /**
     * Reject this promise with a reason.
     */
    reject(reason: any): void {
        this._grab(State.rejected, reason);
    }
    
    /**
     * A shortcut of `Promise.then(() => value)`.
     * @return Return the value itself if it's an instanceof ThenFail Promise.
     */
    static resolve<Value>(value: ThenableOrValue<Value>): Promise<Value> {
        if (value instanceof Promise) {
            return value;
        } else {
            let promise = new Promise<Value>();
            promise.resolve(value);
            return promise;
        }
    }
    
    /**
     * A shortcut of `Promise.then(() => { throw reason; })`.
     */
    static reject(reason: any): Promise<void>;
    static reject<Value>(reason: any): Promise<Value>;
    static reject<Value>(reason: any): Promise<Value> {
        let promise = new Promise<Value>();
        promise.reject(reason);
        return promise;
    }
}

export default Promise;
