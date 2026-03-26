window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    console.log('prevented but no work');
});
