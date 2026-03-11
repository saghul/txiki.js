import assert from 'tjs:assert';
import path from 'tjs:path';


// Use a temp directory so we don't pollute the test directory.
const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-app-XXXXXX'));
const origCwd = tjs.cwd;

tjs.chdir(tmpDir);

try {
    // Scaffold the app.
    const initProc = tjs.spawn([ tjs.exePath, 'app', 'init' ]);
    const initStatus = await initProc.wait();

    assert.ok(initStatus.exit_status === 0, 'app init succeeded');

    // Copy the answer.wasm file into the app.
    const wasmSrc = path.join(import.meta.dirname, 'wasm', 'answer.wasm');
    const wasmDst = path.join(tmpDir, 'app', 'src', 'answer.wasm');

    await tjs.copyFile(wasmSrc, wasmDst);

    // Write main.js that loads and calls the wasm module.
    const mainJs = `
const wasmPath = import.meta.dirname + '/answer.wasm';
const wasmBytes = await tjs.readFile(wasmPath);
const { instance } = await WebAssembly.instantiate(wasmBytes);
const result = instance.exports.answer();
console.log('answer:' + result);
`;

    await tjs.writeFile(path.join(tmpDir, 'app', 'src', 'main.js'), mainJs);

    // Compile the app.
    const exeName = 'wasmapp';
    const compileProc = tjs.spawn([ tjs.exePath, 'app', 'compile', exeName ]);
    const compileStatus = await compileProc.wait();

    assert.ok(compileStatus.exit_status === 0, 'app compile succeeded');

    let exeFileName = exeName;

    if (navigator.userAgentData.platform === 'Windows') {
        exeFileName += '.exe';
    }

    const exePath = path.join(tmpDir, exeFileName);
    const st = await tjs.stat(exePath);

    assert.ok(st.isFile, 'compiled executable exists');

    // Run the compiled executable and verify output.
    const runProc = tjs.spawn(exePath, { stdout: 'pipe' });
    const [ runStatus, stdout ] = await Promise.all([ runProc.wait(), runProc.stdout.text() ]);

    assert.ok(runStatus.exit_status === 0, 'compiled app ran successfully');
    assert.ok(stdout.trim() === 'answer:42', 'wasm returned 42');
} finally {
    tjs.chdir(origCwd);
    await tjs.remove(tmpDir, { recursive: true });
}
