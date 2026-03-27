// sourcemap-src/a.js
function throwFromA() {
  throw new Error("error from a.js");
}

// sourcemap-src/main.js
throwFromA();
//# sourceMappingURL=sourcemap-external-bundle.js.map
