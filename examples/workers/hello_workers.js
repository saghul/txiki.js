
console.log('hello!');

const w = new Worker('examples/worker.js');
w.addEventListener('message', event => {
    const msg = event.data;
    console.log('received message!');
    console.log(JSON.stringify(msg));
    w.terminate();
});

console.log('Worker created!');
