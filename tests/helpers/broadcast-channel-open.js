// Opens a BroadcastChannel and deliberately never closes it. An open channel must
// not keep the event loop alive, so this program should still exit on its own once
// the top-level script finishes (see test-broadcast-channel-no-loop-alive.js).

const bc = new BroadcastChannel('open-forever');

bc.onmessage = () => {};

console.log('opened');
