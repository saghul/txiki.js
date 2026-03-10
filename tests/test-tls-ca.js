import assert from 'tjs:assert';
import path from 'tjs:path';


const fixturesDir = path.join(import.meta.dirname, 'fixtures');
const caPath = path.join(fixturesDir, 'ca.pem');
const helperPath = path.join(import.meta.dirname, 'helpers', 'tls-ca-echo.js');


async function runHelper(args, env) {
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe', env });
    const [ status, stdout, stderr ] = (
        await Promise.allSettled([ proc.wait(), proc.stdout.text(), proc.stderr.text() ])
    ).map(r => r.value);

    return { status, stdout, stderr };
}


// Test --tls-ca CLI option.
async function testCliOption() {
    const { status, stderr } = await runHelper([
        tjs.exePath, '--tls-ca', caPath, 'run', helperPath,
    ]);

    assert.eq(status.exit_status, 0, `--tls-ca failed: ${stderr}`);
}


// Test TJS_CA_BUNDLE env var.
async function testEnvTjsCaBundle() {
    const env = { ...tjs.env, TJS_CA_BUNDLE: caPath };
    const { status, stderr } = await runHelper([ tjs.exePath, 'run', helperPath ], env);

    assert.eq(status.exit_status, 0, `TJS_CA_BUNDLE failed: ${stderr}`);
}


// Test SSL_CERT_FILE env var.
async function testEnvSslCertFile() {
    const env = { ...tjs.env, SSL_CERT_FILE: caPath };
    const { status, stderr } = await runHelper([ tjs.exePath, 'run', helperPath ], env);

    assert.eq(status.exit_status, 0, `SSL_CERT_FILE failed: ${stderr}`);
}


// Test that --tls-ca takes precedence over TJS_CA_BUNDLE.
async function testCliPrecedence() {
    const env = { ...tjs.env, TJS_CA_BUNDLE: '/nonexistent/ca.pem' };
    const { status, stderr } = await runHelper([
        tjs.exePath, '--tls-ca', caPath, 'run', helperPath,
    ], env);

    assert.eq(status.exit_status, 0, `CLI precedence failed: ${stderr}`);
}


// Test that HTTPS fails without the custom CA.
async function testFailsWithoutCa() {
    const env = { ...tjs.env };

    delete env.TJS_CA_BUNDLE;
    delete env.SSL_CERT_FILE;

    const { status } = await runHelper([ tjs.exePath, 'run', helperPath ], env);

    assert.ok(status.exit_status !== 0, 'should fail without custom CA');
}


await testCliOption();
await testEnvTjsCaBundle();
await testEnvSslCertFile();
await testCliPrecedence();
await testFailsWithoutCa();
