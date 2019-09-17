// 2nd bootstrap. Here all modules that need to pollute the global namespace are
// already loaded.
//

import { AbortController, AbortSignal } from '@quv/abort-controller';
import { Console } from '@quv/console';
import { defineEventAttribute, EventTarget, Event, CustomEvent } from '@quv/event-target';
import { Performance } from '@quv/performance';


// Console
//

Object.defineProperty(window, 'console', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: new Console()
});


// EventTarget
//

Object.defineProperties(window, {
    EventTarget: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: EventTarget
    },
    Event: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: Event
    },
    CustomEvent: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: CustomEvent
    }
});

Object.setPrototypeOf(window, EventTarget.prototype);
EventTarget.prototype.__init.call(window);

defineEventAttribute(Object.getPrototypeOf(window), 'load');


// Performance
//

Object.defineProperty(window, 'performance', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: new Performance()
});


// AbortController
//

Object.defineProperty(window, 'AbortController', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: AbortController
});

Object.defineProperty(window, 'AbortSignal', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: AbortSignal
});
