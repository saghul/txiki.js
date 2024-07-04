/**
 * Provides access to most of the POSIX socket API.
 * It can be listened to with poll (libuv poll).
 *
 * NOTE: Not available on Windows.
 *
 * @module tjs:posix-socket
 */
declare module 'tjs:posix-socket' {
    export class PosixSocket {
        constructor(domain: number, type: number, protocol: number);

        readonly info: {
            socket?: {domain: number, type: number, protocol: number}
        };
        readonly fileno: number;
        readonly polling: boolean;
        
        bind(addr: Uint8Array): void;
        connect(addr: Uint8Array): void;
        listen(backlog: number): void;
        accept(): PosixSocket;
        sendmsg(addr: Uint8Array|undefined, control: Uint8Array|undefined, flags: number, ...data: Uint8Array[]): number;
        recv(size: number): Uint8Array;
        recvmsg(size: number): {data: Uint8Array, addr: Uint8Array};
        recvmsg(size: number, controllen: number): {data: Uint8Array, addr: Uint8Array, control: Uint8Array};
        close(): void;
        setopt(level: number, name: number, value: Uint8Array): void;
        /**
        * By default 128byte are reserved for the option, provide size argument for larger buffer or to save memory.
        */
        getopt(level: number, name: number, size?: number): Uint8Array;
        read(size: number): Uint8Array;
        write(data: Uint8Array): number;
        
        poll(cbs: {
            all?: (events: number) => void,
            read?: (events: number) => void,
            write?: (events: number) => void,
            disconnect?: (events: number) => void,
            prioritized?: (events: number) => void,
            error?: (errcode: number) => void,
        }): void;
        stopPoll(): void;

        static readonly defines: {
            AF_INET: number,
            AF_INET6: number,
            /** only on platforms supporting AF_NETLINK */
            AF_NETLINK: number,
            /** only on platforms supporting AF_PACKET */
            AF_PACKET: number,
            /** only on platforms supporting AF_UNIX */
            AF_UNIX: number,
            
            SOCK_STREAM: number,
            SOCK_DGRAM: number,
            SOCK_RAW: number,
            SOCK_SEQPACKET: number,
            SOCK_RDM: number,
            
            SOL_SOCKET: number,
            SOL_PACKET: number,
            SOL_NETLINK: number,
            
            SO_REUSEADDR: number,
            SO_KEEPALIVE: number,
            SO_LINGER: number,
            SO_BROADCAST: number,
            SO_OOBINLINE: number,
            SO_RCVBUF: number,
            SO_SNDBUF: number,
            SO_RCVTIMEO: number,
            SO_SNDTIMEO: number,
            SO_ERROR: number,
            SO_TYPE: number,
            SO_DEBUG: number,
            SO_DONTROUTE: number,
            SO_SNDBUFFORCE: number,
            SO_RCVBUFFORCE: number,
            SO_NO_CHECK: number,
            SO_PRIORITY: number,
            SO_BSDCOMPAT: number,
            SO_REUSEPORT: number,

            IPPROTO_IP: number,
            IPPROTO_IPV6: number,
            IPPROTO_ICMP: number,
            IPPROTO_TCP: number,
            IPPROTO_UDP: number,
        };
        static createFromFD(fd: number): PosixSocket;
        static ip4ToBuf(ipstr: string): Uint8Array;
        static createSockaddrIn(ip: string, port: number): Uint8Array;
        static readonly pollEvents: {
            READABLE: number,
            WRITABLE: number,
            DISCONNECT: number,
            PRIORITIZED: number,
        };
        
        static indextoname(index: number): string;
        static nametoindex(name: string): number;
        
        /**
        * Caculates internet checksum: the 16-bit ones' complement of the ones' complement sum of all 16-bit words in the buffer.
        * Used in ipv4, udp, tcp, icmp...
        * @param buf 
        */
        static checksum(buf: Uint8Array): number;
    }
}
