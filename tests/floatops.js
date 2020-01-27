// Float operations helpers.
//

export function f32ToHex(f32) {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, parseFloat(f32));
    const hex = '0x' + Array
        .apply(null, { length: 4 })
        .map((_, i) => toHex(view.getUint8(i)))
        .join('');
    return BigInt(hex).toString();
}

export function hexToF32(n) {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigInt64(0, BigInt(n));
    return view.getFloat32(4);
}

export function f64ToHex(f64) {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, parseFloat(f64));
    const hex = '0x' + Array
        .apply(null, { length: 8 })
        .map((_, i) => toHex(view.getUint8(i)))
        .join('');
    return BigInt(hex).toString();
}

export function hexToF64(n) {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, BigInt(n));
    return view.getFloat64(0);
}

function toHex(i) {
    return ('00' + i.toString(16)).slice(-2);
}
