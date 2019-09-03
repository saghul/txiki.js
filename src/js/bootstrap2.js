import { defineEventAttribute, EventTarget } from 'event_target';

window.EventTarget = EventTarget;

Object.setPrototypeOf(window, EventTarget.prototype);
EventTarget.call(window);

defineEventAttribute(Object.getPrototypeOf(window), 'load');
