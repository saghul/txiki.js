import assert from 'tjs:assert';

// macOS 15+ (Sequoia) blocks multicast for non-exempt processes due to
// Local Network Privacy (LNP). This affects GitHub Actions runners.
// See: https://github.com/actions/runner-images/issues/10924
let skip = false;

if (navigator.userAgentData.platform === 'macOS' && tjs.env.GITHUB_ACTIONS) {
    const { platformVersion } = await navigator.userAgentData.getHighEntropyValues([ 'platformVersion' ]);
    const darwinMajor = parseInt(platformVersion.split('.')[0]);

    // Darwin 24+ = macOS 15+ (Sequoia).
    if (darwinMajor >= 24) {
        console.log('Skipping test due to macOS 15+ in GHA not working properly');
        skip = true;
    }
}

if (!skip) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const MULTICAST_ADDR = '239.255.0.1';
    const PORT = 41234;

    // Create a receiver socket bound to 0.0.0.0 on a fixed port.
    const receiver = new UDPSocket({
        localAddress: '0.0.0.0',
        localPort: PORT,
        multicastAllowAddressSharing: true,
        multicastLoopback: true,
    });

    const receiverInfo = await receiver.opened;

    // Join the multicast group.
    await receiverInfo.multicastController.joinGroup(MULTICAST_ADDR);
    assert.eq(receiverInfo.multicastController.joinedGroups.length, 1, 'joinedGroups has one entry');
    assert.eq(receiverInfo.multicastController.joinedGroups[0], MULTICAST_ADDR, 'group address matches');

    // Create a sender socket targeting the multicast group.
    const sender = new UDPSocket({
        remoteAddress: MULTICAST_ADDR,
        remotePort: PORT,
        multicastTimeToLive: 1,
        multicastLoopback: true,
    });

    const senderInfo = await sender.opened;

    // Send a message.
    const writer = senderInfo.writable.getWriter();
    await writer.write({ data: encoder.encode('HELLO MULTICAST') });

    // Receive the message.
    const reader = receiverInfo.readable.getReader();
    const { value: msg } = await reader.read();
    const dataStr = decoder.decode(msg.data);
    assert.eq(dataStr, 'HELLO MULTICAST', 'multicast message received');

    // Leave the group.
    await receiverInfo.multicastController.leaveGroup(MULTICAST_ADDR);
    assert.eq(receiverInfo.multicastController.joinedGroups.length, 0, 'joinedGroups is empty');

    // Cleanup.
    reader.cancel();
    writer.close();
    receiver.close();
    sender.close();
}
