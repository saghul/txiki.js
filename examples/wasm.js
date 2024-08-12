const base64 = "AGFzbQEAAAABBgFgAX8BfwMCAQAHBwEDRmliAAAKHgEcACAAQQJJBH8gAAUgAEEBaxAAIABBAmsQAGoLCwANBG5hbWUBBgEAA0ZpYg==";
const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
const wasmModule = new WebAssembly.Module(buffer);
const instance = new WebAssembly.Instance(wasmModule, {});
const fib = instance.exports.Fib;
for (let i = 0; i < 10; i++) {
  console.log(`fib(${i}) = ${fib(i)}`);
}
