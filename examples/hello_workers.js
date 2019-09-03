
console.log('hello!');

const w = new quv.Worker('examples/worker.js');
w.onmessage = msg => {
    console.log('received message!');
    console.log(JSON.stringify(msg));
    w.terminate();
}

console.log('Worker created!');
