/* GunDB + TJS */

import 'https://cdn.jsdelivr.net/npm/gun/gun.js';
var gun = Gun();

gun.get('tjs').put({
  name: "gundb",
  status: "works!"
});

gun.get('tjs').on(function(data, key){
  console.log("update:", data);
});
