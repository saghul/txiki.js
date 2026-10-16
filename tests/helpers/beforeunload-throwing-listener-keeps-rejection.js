addEventListener('beforeunload', () => {
    throw new Error('bu-should-not-run');
});

Promise.reject(new Error('rejection-kept'));
