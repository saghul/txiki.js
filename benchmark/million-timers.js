const NUM_TIMERS = 1_000_000;

let timerCalls = 0;
let timeout = 0;

function timerCb() {
    timerCalls++;

    if (timerCalls === NUM_TIMERS) {
        performance.mark('end');

        console.log(performance.measure('full', 'start', 'end'));
        console.log(performance.measure('just-timers', 'end-start', 'end'));
    }
}

performance.mark('start');

for (let i = 0; i < NUM_TIMERS; i++) {
    if (i % 1000 === 0) {
        timeout++;
    }

    setTimeout(timerCb, timeout);
}

performance.mark('end-start');
