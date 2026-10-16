// Listener errors are reported by dispatchEvent and don't propagate, so make
// the beforeunload dispatch itself throw. Install it after 'load' fired.
addEventListener('load', () => {
    globalThis.dispatchEvent = () => {
        throw new Error('bu-dispatch-throws');
    };
});
