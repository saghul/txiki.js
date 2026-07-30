import assert from 'tjs:assert';
import FFI from 'tjs:ffi';

const tmT = new FFI.StructType([
	['sec', FFI.types.sint],
	['min', FFI.types.sint],
	['hour', FFI.types.sint],
	['mday', FFI.types.sint],
	['mon', FFI.types.sint],
	['year', FFI.types.sint],
	['wday', FFI.types.sint],
	['yday', FFI.types.sint],
	['isdst', FFI.types.sint],
], 'tm');
const { symbols, close } = FFI.dlopen(FFI.LIBC_NAME, {
	time: { args: [FFI.types.pointer], returns: FFI.types.sint64 },
	localtime: { args: [new FFI.PointerType(FFI.types.sint64, 1)], returns: new FFI.PointerType(tmT, 1) },
});
const timestamp = symbols.time(null);
assert.ok(Date.now()/1000 - timestamp < 2);

const testTimestamp = 1658319387; // test with 2022-07-20T14:16:27+02:00
const tmPtr = symbols.localtime(FFI.Pointer.createRef(FFI.types.sint64, testTimestamp));
const tm = tmPtr.deref();
assert.eq(tm.year, 122); // years since 1900
assert.eq(tm.mon, 6); // month since January, 0-11
const cmpDate = new Date(testTimestamp*1000);
assert.eq(tm.mday, cmpDate.getDate()); // day of the month, 1-31
assert.eq(tm.hour, cmpDate.getHours()); // hours since midnight, 0-23
assert.eq(tm.min, cmpDate.getMinutes()); // minutes after the hour, 0-59
assert.eq(tm.sec, cmpDate.getSeconds()); // seconds after the minute, 0-59
assert.eq(tm.wday, cmpDate.getDay()); // day of the week, Sunday is 0, 0-6
const startOf2022 = new Date(2022, 0, 1, 0, 0, 0, 0);
assert.eq(tm.yday, Math.floor((cmpDate-startOf2022)/86e6)-1); // day of the year, 0-365
assert.eq(tm.isdst, cmpDate.getTimezoneOffset() != (new Date(2022,1,1,1,1,1)).getTimezoneOffset() ? 1 : 0); // daylight saving time, 0 or 1

close();
