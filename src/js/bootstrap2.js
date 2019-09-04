// 2nd bootstrap. Here all modules that need to pollute the global namespace are
// already loaded.
//

import { defineEventAttribute, EventTarget } from 'event_target';
import { Performance } from 'performance';


window.EventTarget = EventTarget;

Object.setPrototypeOf(window, EventTarget.prototype);
EventTarget.call(window);

defineEventAttribute(Object.getPrototypeOf(window), 'load');

window.performance = new Performance();
