/// <reference path="../docs/txikijs.d.ts" />
import assert from './assert.js';

const PosixSocket = tjs.PosixSocket;

const fromHexString = (hexString) =>
  Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

function testUdpSock(){
	const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);
	const sockaddr_bind = PosixSocket.createSockaddrIn('0.0.0.0', 12345);
	assert.eq(sockaddr_bind, fromHexString('02003039000000000000000000000000'));
	sock.bind(sockaddr_bind);
	const sockaddr_rem = PosixSocket.createSockaddrIn('127.0.0.1', 12345)
	const sendbuf = (new TextEncoder).encode('Hello, world!');	
	const sendsz = sock.sendmsg(sockaddr_rem, undefined, 0, sendbuf);
	assert.eq(sendsz, sendbuf.length);
	const recv = sock.recvmsg(sendbuf.length, 0);
	assert.eq(sendbuf, recv.data);
	assert.eq(sockaddr_rem, recv.addr);
	sock.close();
}

async function testTcpSock(){
	const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_STREAM, 0);
	const sockaddr_bind = PosixSocket.createSockaddrIn('0.0.0.0', 55678);
	assert.eq(sockaddr_bind, fromHexString('0200d97e000000000000000000000000'));

	const optval = new Uint8Array(4);
	(new DataView(optval.buffer)).setUint32(0, 1, true);
	sock.setopt(PosixSocket.defines.SOL_SOCKET, PosixSocket.defines.SO_REUSEADDR, optval);
	const optval2 = sock.getopt(PosixSocket.defines.SOL_SOCKET, PosixSocket.defines.SO_REUSEADDR);
	assert.eq(optval, optval2);
	
	sock.bind(sockaddr_bind);
	sock.listen(1);
	const sendbuf = (new TextEncoder).encode('Hello, world!');	

	let clientRecv = 0;
	tjs.connect('tcp', '127.0.0.1', 55678).then(async con=>{
		const buf = new Uint8Array(20);
		clientRecv = await con.read(buf);
		assert.eq(clientRecv, sendbuf.length);
		con.close();
	});

	await new Promise(res=>setTimeout(res, 500))
	const con = sock.accept();
	assert.eq(con.write(sendbuf), sendbuf.length);
	await new Promise(res=>setTimeout(res, 300))
	assert.eq(clientRecv, sendbuf.length);;
	con.close();
	sock.close();
}

async function testPoll(){
	const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);
	sock.bind(PosixSocket.createSockaddrIn('0.0.0.0', 12345));
	const sockaddr_rem = PosixSocket.createSockaddrIn('127.0.0.1', 12345);
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

async function run(){
	testUdpSock();
	testTcpSock();
	testPoll();
}
run();
