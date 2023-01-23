/**
 * only tested on linux
 * will not work on windows
 * 
 * This is a simple class utilizing the PosixSocket api to listen to all all incoming ip packets
 * including the ethernet header.
 */

import ffi from 'tjs:ffi';

function swap16(val) {
    return ((val & 0xFF) << 8)
           | ((val >> 8) & 0xFF);
}
function htons(val){
	const LITTLE_ENDIAN = true; //most platforms are little endian
	return LITTLE_ENDIAN ? swap16(val) : val;
}

const PosixSocket = tjs.PosixSocket;
export class PacketSocket {
	constructor(_onPacket, iface) {
		this._onPacket = _onPacket;
		const ETH_P_IP = 0x0800;
		this._psock = new tjs.PosixSocket(PosixSocket.defines.AF_PACKET, PosixSocket.defines.SOCK_RAW, htons(ETH_P_IP));
		const sockaddr = new Uint8Array(20);
		sockaddr.fill(0);
		const dv = new DataView(sockaddr.buffer);
		dv.setUint16(0, PosixSocket.defines.AF_PACKET, true); // sll_family
		dv.setUint16(2, ETH_P_IP, false); // sll_protocol = htons(ETH_P_IP);
		if (iface != undefined) {
			const libc = new ffi.Lib(ffi.Lib.LIBC_NAME);
			libc.parseCProto('unsigned int if_nametoindex(const char *ifname);');
			const ifindex = libc.call('if_nametoindex', [iface]);

			dv.setUint32(4, ifindex, true); // sll_ifindex
		}
		this._psock.bind(sockaddr);
	}
	listen() {
		this._psock.poll({
			error: (err) => {
				console.error('error on PosixSocket', err);
			},
			read: () => {
				const { addr, data } = this._psock.recvmsg(1500); // mtu is <=1500
				this._onPacket(data);
			}
		});
	}
	close() {
		this._psock.close();
	}
	send(buf) {
		return this._psock.sendmsg(undefined, undefined, 0, buf);
	}
	static parseEthHdr(buf) {
		const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
		return {
			dst: buf.slice(0, 6),
			src: buf.slice(6, 12),
			type: dv.getUint16(12, false),
		};
	}
	static createEthHdr(dst, src, type) {
		const buf = new Uint8Array(14);
		buf.set(dst, 0);
		buf.set(src, 6);
		const dv = new DataView(buf.buffer);
		dv.setUint16(12, type, false);
		return buf;
	}
	static parseIp4Hdr(bufArg, offset = 14) {
		const buf = bufArg.subarray(offset, offset + 20);
		const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
		const b1 = dv.getUint8(0);
		const w6 = dv.getUint16(6, false);
		const ihl = b1 & 0x0f;
		return {
			version: (b1 >> 4) & 0x0f,
			ihl,
			tos: dv.getUint8(1),
			tlen: dv.getUint16(2, false),
			id: dv.getUint16(4, false),
			flags: (w6 >> 13) & 0b111,
			offset: w6 & 0x1fff,
			ttl: dv.getUint8(8),
			proto: dv.getUint8(9),
			chksum: dv.getUint16(10, false),
			src: buf.slice(12, 16),
			dst: buf.slice(16, 20),
			_hdrlen: ihl * 4
			// Options are not handled
		};
	}
	static createIp4Hdr(hdr) {
		const buf = new Uint8Array(20);
		const dv = new DataView(buf.buffer);
		dv.setUint8(0, 0x45); // ihl + version
		dv.setUint8(1, 0); // tos
		dv.setUint16(2, hdr.datalen + 20, false); // tlen
		dv.setUint16(4, Math.round(Math.random() * 0xFFFF), false); // id
		dv.setUint16(6, 0x0, false); // flags + offset
		dv.setUint8(8, hdr.ttl != undefined ? hdr.ttl : 100); // ttl
		dv.setUint8(9, hdr.proto); // proto
		// skip 2b checksum
		buf.set(hdr.src, 12);
		buf.set(hdr.dst, 16);
		dv.setUint16(10, checksum(buf), false); // chksum
		return buf;
	}
}

const iface = tjs.networkInterfaces().find(ifc=>!ifc.internal).name;
const sock = new PacketSocket(buf => {
	try{
		const eth = PacketSocket.parseEthHdr(buf);
		const ip4hdr = PacketSocket.parseIp4Hdr(buf, 14);
		console.log('received pkt from', 
			Array.from(eth.src).map(x=>x.toString(16).padStart(2, '0')).join(':'),
			Array.from(ip4hdr.src).map(x => x.toString(10)).join('.')
		);
		tjs.exit(0);
	}catch(e){
		console.log('failed to parse packet', e);
	}
}, tjs.networkInterfaces().find(ifc=>!ifc.internal).name);
sock.listen();
console.log('Listening on ', iface)
