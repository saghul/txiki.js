Date += Date;

addEventListener('unhandledrejection', e => {
    e.preventDefault();
    console.log('handled:' + e.reason);
});

Promise.reject(new Error('date-overwritten-handled'));
