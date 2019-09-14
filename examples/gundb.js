/* GunDB + QUV */

import 'https://cdn.jsdelivr.net/npm/gun/gun.js';
var gun = Gun();

gun.get('quv').put({
  name: "gundb",
  status: "works!"
});

gun.get('quv').on(function(data, key){
  console.log("update:", data);
});
