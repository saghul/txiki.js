import assert from 'tjs:assert';
import { PosixSocket } from 'tjs:posix-socket';


// Pick a random port in the dynamic/private range to avoid clashes with
// lingering sockets (e.g. TIME_WAIT) from previous runs on the CI machine.
function randomPort(){
	return 49152 + Math.floor(Math.random() * (65535 - 49152));
}

// Build the sockaddr_in bytes we expect createSockaddrIn() to produce, so the
// assertions stay valid for any port. macOS and Linux lay out the struct
// differently (sin_len byte vs. 16-bit sin_family).
function expectedSockaddrIn(ip, port){
	const buf = new Uint8Array(16);
	if(navigator.userAgentData.platform == 'macOS'){
		buf[1] = 0x02; // sin_len left 0, sin_family = AF_INET
	}else{
		buf[0] = 0x02; // sin_family = AF_INET (16-bit, little-endian)
	}
	buf[2] = (port >> 8) & 0xff; // sin_port, network byte order (big-endian)
	buf[3] = port & 0xff;
	const octets = ip.split('.');
	for(let i = 0; i < 4; i++){
		buf[4 + i] = parseInt(octets[i], 10);
	}
	return buf;
}

function testUdpSock(){
	const port = randomPort();
	const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);
	const sockaddr_bind = PosixSocket.createSockaddrIn('0.0.0.0', port);
	assert.eq(sockaddr_bind, expectedSockaddrIn('0.0.0.0', port));
	sock.bind(sockaddr_bind);
	const sockaddr_rem = PosixSocket.createSockaddrIn('127.0.0.1', port)
	const sendbuf = (new TextEncoder).encode('Hello, world!');
	const sendsz = sock.sendmsg(sockaddr_rem, undefined, 0, sendbuf);
	assert.eq(sendsz, sendbuf.length);
	const recv = sock.recvmsg(sendbuf.length, 0);
	assert.eq(sendbuf, recv.data);
	if(navigator.userAgentData.platform == 'macOS'){ // macos prefixes sockaddr with length (when coming from kernel), so we just skip it
		assert.eq(sockaddr_rem.slice(1), recv.addr.slice(1));
	}else{
		assert.eq(sockaddr_rem, recv.addr);
	}
	sock.close();
}

async function testTcpSock(){
	const port = randomPort();
	const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_STREAM, 0);
	const sockaddr_bind = PosixSocket.createSockaddrIn('0.0.0.0', port);
	assert.eq(sockaddr_bind, expectedSockaddrIn('0.0.0.0', port));

	const optval = new Uint8Array(4);
	(new DataView(optval.buffer)).setUint32(0, 1, true);
	sock.setopt(PosixSocket.defines.SOL_SOCKET, PosixSocket.defines.SO_REUSEADDR, optval);
	assert.throws(()=>sock.getopt(9999, PosixSocket.defines.SO_REUSEADDR, 1), Error, 'asd');
	assert.throws(()=>sock.getopt(PosixSocket.defines.SOL_SOCKET, PosixSocket.defines.SO_REUSEADDR, 0));
	assert.throws(()=>sock.getopt(PosixSocket.defines.SOL_SOCKET, PosixSocket.defines.SO_BINDTODEVICE, 1));
	const optval2 = sock.getopt(PosixSocket.defines.SOL_SOCKET, PosixSocket.defines.SO_REUSEADDR, 4);
	if(navigator.userAgentData.platform != 'macOS'){ // skip this one on macos, the result there seems to be different
		assert.eq(optval, optval2);
	}
	
	sock.bind(sockaddr_bind);
	sock.listen(1);
	const sendbuf = (new TextEncoder).encode('Hello, world!');	

	let clientRecv = 0;
	tjs.connect('tcp', '127.0.0.1', port).then(async con=>{
		const { readable } = await con.opened;
		const reader = readable.getReader();
		const { value } = await reader.read();
		clientRecv = value.length;
		assert.eq(clientRecv, sendbuf.length);
		reader.cancel();
	});

	await new Promise(res=>setTimeout(res, 500))
	const con = sock.accept();
	assert.truthy(con instanceof PosixSocket);
	assert.eq(con.write(sendbuf), sendbuf.length);
	await new Promise(res=>setTimeout(res, 300))
	assert.eq(clientRecv, sendbuf.length);;
	con.close();
	sock.close();
}

async function testPoll(){
	const port = randomPort();
	const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);
	const info = sock.info;
	assert.eq(info.socket.domain, PosixSocket.defines.AF_INET);
	assert.eq(info.socket.type, PosixSocket.defines.SOCK_DGRAM);
	assert.eq(info.socket.protocol, PosixSocket.defines.IPPROTO_UDP); // automatically determined by SOCK_DGRAM
	sock.bind(PosixSocket.createSockaddrIn('0.0.0.0', port));
	const sockaddr_rem = PosixSocket.createSockaddrIn('127.0.0.1', port);
	function send(buf){
		return sock.sendmsg(sockaddr_rem, undefined, 0, buf);
	}
	assert.ok(sock.fileno > 0);

	let gotReadCb = false;
	sock.poll({
		read: ()=>{
			gotReadCb = true;
			setTimeout(()=>sock.stopPoll(), 0); // setImmediate
		}
	});
	const sendbuf = (new TextEncoder).encode('Hello, world!');
	assert.eq(send(sendbuf), sendbuf.length);
	await new Promise(res=>setTimeout(res, 300));
	assert.ok(gotReadCb);
	sock.stopPoll();
	sock.close();
}

async function testPollFinalizerClose(){
	function make(){
		const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);
		sock.bind(PosixSocket.createSockaddrIn('127.0.0.1', 0));
		sock.poll({ read: () => {} });
	}

	make();
	tjs.engine.gc.run();
	tjs.engine.gc.run();
	await new Promise(res=>setTimeout(res, 50));
	assert.ok(true);
}

function testHelpers(){
	const nis = tjs.system.networkInterfaces;
	for(const ni of nis){
		const ind = PosixSocket.nametoindex(ni.name);
		assert.truthy(ind >= 0);
		const name2 = PosixSocket.indextoname(ind);
		assert.eq(ni.name, name2);
	}

	assert.eq(PosixSocket.checksum(new Uint8Array(
		`45 00 00 99 12 9f 40 00 01 11 00 00 0a 00 00 7a ef ff ff fa`.split(' ').map(x=>parseInt(x, 16))
	)), 0x416c);
}

async function run(){
	if(navigator.userAgentData.platform == 'Windows'){
		// This module is only supported on Unix systems.
		return;
	}
	testUdpSock();
	testTcpSock();
	testPoll();
	await testPollFinalizerClose();
	testHelpers();
}
run();
