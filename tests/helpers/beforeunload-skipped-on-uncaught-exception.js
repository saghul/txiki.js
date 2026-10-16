addEventListener('beforeunload', () => console.log('beforeunload fired'));

setTimeout(() => {
    throw new Error('uncaught-skip-bu');
}, 1);
