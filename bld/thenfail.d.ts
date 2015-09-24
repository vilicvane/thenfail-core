/**
 * ThenFail v0.3 Core
 * Just another Promises/A+ Library
 *
 * https://github.com/vilic/thenfail
 *
 * MIT License
 */
export declare type ThenableOrValue<Value> = Promise<Value> | Thenable<Value> | Value;
/**
 * Promise like object.
 */
export interface Thenable<Value> {
    then<Return>(onfulfilled: (value: Value) => ThenableOrValue<Return>, onrejected: (reason: any) => any): Thenable<Return>;
}
export declare type Resolver<Value> = (resolve: (value?: ThenableOrValue<Value>) => void, reject: (reason: any) => void) => void;
export declare type OnFulfilledHandler<Value, Return> = (value: Value) => ThenableOrValue<Return>;
export declare type OnRejectedHandler<Return> = (reason: any) => ThenableOrValue<Return>;
export declare type OnAnyHandler<Return> = (valueOrReason: any) => ThenableOrValue<Return>;
/**
 * Possible states of a promise.
 */
export declare const enum State {
    pending = 0,
    fulfilled = 1,
    rejected = 2,
    interrupted = 3,
}
export declare class Promise<Value> implements Thenable<Value> {
    private _state;
    private _running;
    private _valueOrReason;
    /**
     * Next promises in the chain.
     */
    private _chainedPromise;
    private _chainedPromises;
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
    private _handledPromise;
    private _handledPromises;
    private _onPreviousFulfilled;
    private _onPreviousRejected;
    /**
     * Promise constructor.
     */
    constructor();
    constructor(resolver: Resolver<Value>);
    /**
     * Get the state from previous promise in chain.
     */
    private _grab(previousState, previousValueOrReason?);
    /**
     * Invoke `onfulfilled` or `onrejected` handlers.
     */
    private _run(handler, previousValueOrReason);
    /**
     * The resolve process defined in Promises/A+ specifications.
     */
    private _unpack(value, callback);
    /**
     * Set the state of current promise and relay it to next promises.
     */
    private _relay(state, valueOrReason?);
    /**
     * The `then` method that follows Promises/A+ specifications <https://promisesaplus.com>.
     * To learn how to use promise, please check out <https://github.com/vilic/thenfail>.
     */
    then<Return>(onfulfilled: OnFulfilledHandler<Value, Return>, onrejected?: OnRejectedHandler<Return>): Promise<Return>;
    then(onfulfilled: void, onrejected: OnRejectedHandler<Value>): Promise<Value>;
    /**
     * Resolve this promise with a value or thenable.
     * @param value A normal value, or a promise/thenable.
     */
    resolve(value?: ThenableOrValue<Value>): void;
    /**
     * Reject this promise with a reason.
     */
    reject(reason: any): void;
    /**
     * A shortcut of `Promise.then(() => value)`.
     * @return Return the value itself if it's an instanceof ThenFail Promise.
     */
    static resolve<Value>(value: ThenableOrValue<Value>): Promise<Value>;
    /**
     * A shortcut of `Promise.then(() => { throw reason; })`.
     */
    static reject(reason: any): Promise<void>;
    static reject<Value>(reason: any): Promise<Value>;
}
export default Promise;
