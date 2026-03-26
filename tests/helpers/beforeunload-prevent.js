let count = 0;

window.addEventListener('beforeunload', (e) => {
    count++;
    console.log(`beforeunload count=${count}`);

    if (count === 1) {
        e.preventDefault();
        setTimeout(() => {
            console.log('timer from beforeunload');
        }, 10);
    }
});
