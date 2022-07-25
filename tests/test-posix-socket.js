/// <reference path="../docs/txikijs.d.ts" />
import assert from './assert.js';

const PosixSocket = tjs.PosixSocket;

function testUdpSock(){
	const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_DGRAM, 0);
	const sockaddr_bind = PosixSocket.createSockaddrIn('0.0.0.0', 12345);
	assert.eq(sockaddr_bind.compare(Buffer.from('02003039000000000000000000000000', 'hex')), 0);
	sock.bind(sockaddr_bind);
	const sockaddr_rem = PosixSocket.createSockaddrIn('127.0.0.1', 12345)
	const sendbuf = Buffer.from('Hello, world!');	
	const sendsz = sock.sendmsg(sockaddr_rem, undefined, 0, sendbuf);
	assert.eq(sendsz, sendbuf.length);
	const recv = sock.recvmsg(sendbuf.length, 0);
	assert.eq(sendbuf.compare(recv.data), 0);
	assert.eq(sockaddr_rem.compare(recv.addr), 0);
}

async function testTcpSock(){
	const sock = new PosixSocket(PosixSocket.defines.AF_INET, PosixSocket.defines.SOCK_STREAM, 0);
	const sockaddr_bind = PosixSocket.createSockaddrIn('0.0.0.0', 55678);
	assert.eq(sockaddr_bind.compare(Buffer.from('0200d97e000000000000000000000000', 'hex')), 0);

	const optval = Buffer.alloc(4);
	optval.writeUint32LE(1, 0);
	sock.setopt(PosixSocket.defines.SOL_SOCKET, PosixSocket.defines.SO_REUSEADDR, optval);
	const optval2 = sock.getopt(PosixSocket.defines.SOL_SOCKET, PosixSocket.defines.SO_REUSEADDR);
	assert.eq(optval.compare(optval2), 0);
	
	sock.bind(sockaddr_bind);
	sock.listen(1);
	const sendbuf = Buffer.from('Hello, world!');	

	let clientRecv = 0;
	tjs.connect('tcp', '127.0.0.1', 55678).then(async con=>{
		const buf = Buffer.alloc(20);
		await new Promise(res=>setTimeout(res, 500));
		clientRecv = await con.read(buf);
		assert.eq(clientRecv, sendbuf.length);
		con.close();
	});

	await new Promise(res=>setTimeout(res, 500));
	const con = sock.accept();
	assert.eq(con.write(sendbuf), sendbuf.length);
	assert.eq(clientRecv, sendbuf.length);
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
	const sendbuf = Buffer.from('Hello, world!');
	assert.eq(send(sendbuf), sendbuf.length);
	await new Promise(res=>setTimeout(res, 300));
	assert.ok(gotReadCb);
	sock.stopPoll();
	sock.close();
}

//testUdpSock();

//testTcpSock();

testPoll();
