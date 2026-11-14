export function throwFromA() {
    const values = [ 1, 2, -3 ];
    const negative = values.find(value => value < 0);

    throw new Error(`error from a.js: unexpected negative value ${negative}`);
}
