addEventListener('beforeunload', () => console.log('beforeunload fired'));

Promise.reject(new Error('unhandled-skip-bu'));
