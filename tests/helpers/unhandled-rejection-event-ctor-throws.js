// Make only the 'unhandledrejection' event constructor throw, so other events
// (e.g. 'load' and 'beforeunload') keep working.
const set = WeakMap.prototype.set;

WeakMap.prototype.set = function(key, value) {
    if (value?.eventType === 'unhandledrejection') {
        throw new Error('event-ctor-broken');
    }

    return set.call(this, key, value);
};

Promise.reject(new Error('ctor-throws'));
