import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// An enum field packs from a member name and unpacks back to it, over the
// integer the enum is stored in.
const { defineEnum, defineStruct, types } = FFI;

const status = defineEnum({ PENDING: 0, ACTIVE: 1, FAILED: 2 });
const priority = defineEnum({ LOW: 0, HIGH: 1 }, 'u8');

// A C enum is an `int` unless it says otherwise, which is what the default is.
assert.eq(status.type, types.sint);
assert.eq(status.size, types.sint.size);
assert.eq(priority.size, 1);
assert.eq(priority.type, types.uint8);
assert.eq(status.members.ACTIVE, 1);

const task = defineStruct([ [ 'id', 'u32' ], [ 'status', status ], [ 'priority', priority ] ]);

assert.eq(task.unpack(task.pack({ id: 7, status: 'ACTIVE', priority: 'HIGH' })),
          { id: 7, status: 'ACTIVE', priority: 'HIGH' });

// The raw integer is accepted too, as long as it is one the enum maps, so a
// value read out of a header or another struct can be packed straight back.
assert.eq(task.unpack(task.pack({ id: 7, status: 2, priority: 0 })).status, 'FAILED');

// The field really is the width the enum asked for.
const [ , statusField, priorityField ] = task.describe();

assert.eq(statusField.size, 4);
assert.eq(statusField.type, 'enum(PENDING, ACTIVE, FAILED)');
assert.eq(priorityField.size, 1);

// Negative enumerators, which C uses for error codes, need the signed default.
const result = defineEnum({ ERROR: -1, OK: 0 });
const call = defineStruct([ [ 'result', result ] ]);

assert.eq(call.unpack(call.pack({ result: 'ERROR' })).result, 'ERROR');
