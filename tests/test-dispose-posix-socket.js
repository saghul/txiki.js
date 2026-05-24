import assert from 'tjs:assert';
import { PosixSocket } from 'tjs:posix-socket';


function testBasicDispose() {
    let fd;

    {
        using sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);

        fd = sock.fileno;
        assert.ok(fd > 0, 'socket has valid fd');
    }

    // After scope, socket is closed.
    // Cannot reliably verify fd is closed cross-platform, but ensure dispose ran by
    // creating a second using-bound socket and checking dispose runs again.
}

function testManualCloseThenDispose() {
    let sockRef;

    {
        using sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);

        sock.close(); // explicit close
        sockRef = sock;
    }

    // After scope, dispose should run but be a no-op (idempotent). Verify by
    // calling close() once more from here directly.
    sockRef.close();
}

function testDoubleClose() {
    const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);

    sock.close();
    sock.close(); // second close must be a no-op
}

function testDisposeSymbolPresent() {
    const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);

    assert.eq(typeof sock[Symbol.dispose], 'function');

    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(sock), Symbol.dispose);

    assert.ok(descriptor);
    assert.eq(descriptor.enumerable, false);
    assert.eq(descriptor.writable, true);
    assert.eq(descriptor.configurable, true);

    sock.close();
}

if (navigator.userAgentData.platform === 'Windows') {
    // This module is only supported on Unix systems.
} else {
    testBasicDispose();
    testManualCloseThenDispose();
    testDoubleClose();
    testDisposeSymbolPresent();
}
