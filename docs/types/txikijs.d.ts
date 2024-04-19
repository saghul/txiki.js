/**
 * The main txiki.js APIs are exposed as a single `tjs` global object.
 *
 * @module global
 */

declare global {
    /**
    * The main global where txiki.js APIs are exposed.
    */
    namespace tjs {
        /**
        * Implemented by entities from which data can be read.
        */
        interface Reader {
            /**
            * Reads data into the given buffer. Resolves to the number of read bytes or null for EOF.
            *
            * @param buf Buffer to read data into.
            */
            read(buf: Uint8Array): Promise<number|null>;
        }
        
        /**
        * Implemented by entities to which data can be written.
        */
        interface Writer {
            /**
            * Writes the given data buffer. Resolves to the number of written bytes.
            *
            * @param buf Buffer of data to write.
            */
            write(buf: Uint8Array): Promise<number>;
        }
        
        /**
        * Alerts the user about something.
        *
        * @param masg The message that will be displayed.
        */
        function alert(msg:string): Promise<void>;
        
        /**
        * Asks the user for confirmation.
        *
        * @param msg The message which will be printed as the question. Defaults to "Confirm".
        */
        function confirm(msg:string): Promise<boolean>;
        
        /**
        * Prompt the user for input.
        *
        * @param msg Message to ask the user.
        * @param def Default value in case nothing was entered.
        */
        function prompt(msg:string, def?:string): Promise<string|null>;
        
        /**
        * Array with the arguments passed to the binary.
        */
        const args: string[];
        
        type Signal = 'SIGHUP' | 'SIGINT' | 'SIGQUIT' | 'SIGILL' | 'SIGTRAP'
        | 'SIGABRT' | 'SIGBUS' | 'SIGFPE' | 'SIGKILL' | 'SIGUSR1' | 'SIGSEGV'
        | 'SIGUSR2' | 'SIGPIPE' | 'SIGALRM' | 'SIGTERM' | 'SIGSTKFLT'
        | 'SIGCHLD' | 'SIGCONT' | 'SIGSTOP' | 'SIGTSTP' | 'SIGTTIN' | 'SIGTTOU'
        | 'SIGURG' | 'SIGXCPU' | 'SIGXFSZ' | 'SIGVTALRM' | 'SIGPROF' | 'SIGWINCH'
        | 'SIGPOLL' | 'SIGPWR' | 'SIGSYS';
        
        /**
        * Signal listener function.
        */
        type SignalListener = () => void;

        /**
        * Registers a listener for the given signal.
        *
        * ```js
        * tjs.addSignalListener('SIGINT', handleSigint);
        * ```
        *
        * @param sig Which signal to register a listener for.
        * @param listener Listener function.
        */
        function addSignalListener(sig: Signal, listener: SignalListener): void;

        /**
        * Un-registers a listener for the given signal.
        *
        * ```js
        * tjs.removeSignalListener('SIGINT', handleSigint);
        * ```
        *
        * @param sig Which signal to un-register a listener for.
        * @param listener Listener function.
        */
        function removeSignalListener(sig: Signal, listener: SignalListener): void;

        /**
        * Send a signal to a process.
        *
        * @param pid The pid of the process to send a signal to.
        * @param sig The name of the signal to send. Defaults to "SIGTERM".
        */
        function kill(pid: number, sig?: Signal): void;
        
        /**
        * Triggers a garbage collection cycle.
        */
        function gc(): void;
        
        /**
        * The txiki.js version.
        */
        const version: string;
        
        /**
        * Versions of all included libraries and txiki.js itself.
        */
        const versions: {
            quickjs: string;
            tjs: string;
            uv: string;
            curl: string;
            wasm3: string;
        };
        
        /**
        * Full path to the txiki.js running executable.
        */
        const exepath: string;
        
        /**
        * Object containing environment variables.
        * Setting and deleting properties on this object causes
        * environment variables to be set / deleted.
        */
        type Environment = { [index: string]: string };
        
        /**
        * System environment variables.
        */
        const env: Environment;
        
        /**
        * Returns the current system hostname.
        */
        function gethostname(): string;
        
        /**
        * String representation of the current platform.
        */
        const platform: 'linux' | 'darwin' | 'windows';
        
        /**
        * Exit the current running program.
        *
        * @param code Program exit code.
        */
        function exit(code: number): void;
        
        /**
        * Changes the current working directory.
        */
        function chdir(dir: string): void;
        
        /**
        * Gets the current working directory.
        */
        function cwd(): string;
        
        /**
        * Constants describing a socket family.
        */
        const AF_INET: number;
        const AF_INE6: number;
        const AF_UNSPEC: number;
        
        /**
        * Constants to be used with {@link getaddrinfo}'s `hints` parameter.
        */
        const SOCK_STREAM: number;
        const SOCK_DGRAM: number;

        /**
        * Constants to be used with {@link getaddrinfo}'s `hints` parameter.
        */
        const IPPROTO_TCP: number;
        const IPPROTO_UDP: number;

        /**
        * Constant to be used with {@link getaddrinfo}'s `hints` parameter.
        */
        const AI_PASSIVE: number;
        const AI_CANONNAME: number;
        const AI_NUMERICHOST: number;
        const AI_V4MAPPED: number;
        const AI_ALL: number;
        const AI_ADDRCONFIG: number;
        const AI_NUMERICSERV: number;

        /**
        * Hints for {@link getaddrinfo}.
        */
        interface Hints {
            socktype?: number;
            protocol?: number;
            family?: number;
            flags?: number;
        }
        
        /**
        * Result type for {@link getaddrinfo}.
        */
        interface Addrinfo {
            socktype: number;
            protocol: number;
            canonname?: string;
            family: number;
            ip: string;
            port: number;
            scopeId?: number;
            flowinfo?: number;
        }
        
        /**
        * Basic DNS resolution using [getaddrinfo(3)](https://man7.org/linux/man-pages/man3/getaddrinfo.3.html).
        *
        * @param node Hostname to be looked up.
        * @param service Service / port to be looked up.
        * @param hints Criteria for selecting the results.
        */
        function getaddrinfo(node: string, service?: string | number, hints?: Hints): Promise<Addrinfo[]>;
        
        interface IErrors {
            /*
            * Error code constants.
            */
            E2BIG: number;
            EACCES: number;
            EADDRINUSE: number;
            EADDRNOTAVAIL: number;
            EAFNOSUPPORT: number;
            EAGAIN: number;
            EAI_ADDRFAMILY: number;
            EAI_AGAIN: number;
            EAI_BADFLAGS: number;
            EAI_BADHINTS: number;
            EAI_CANCELED: number;
            EAI_FAIL: number;
            EAI_FAMILY: number;
            EAI_MEMORY: number;
            EAI_NODATA: number;
            EAI_NONAME: number;
            EAI_OVERFLOW: number;
            EAI_PROTOCOL: number;
            EAI_SERVICE: number;
            EAI_SOCKTYPE: number;
            EALREADY: number;
            EBADF: number;
            EBUSY: number;
            ECANCELED: number;
            ECHARSET: number;
            ECONNABORTED: number;
            ECONNREFUSED: number;
            ECONNRESET: number;
            EDESTADDRREQ: number;
            EEXIST: number;
            EFAULT: number;
            EFBIG: number;
            EHOSTUNREACH: number;
            EINTR: number;
            EINVAL: number;
            EIO: number;
            EISCONN: number;
            EISDIR: number;
            ELOOP: number;
            EMFILE: number;
            EMSGSIZE: number;
            ENAMETOOLONG: number;
            ENETDOWN: number;
            ENETUNREACH: number;
            ENFILE: number;
            ENOBUFS: number;
            ENODEV: number;
            ENOENT: number;
            ENOMEM: number;
            ENONET: number;
            ENOPROTOOPT: number;
            ENOSPC: number;
            ENOSYS: number;
            ENOTCONN: number;
            ENOTDIR: number;
            ENOTEMPTY: number;
            ENOTSOCK: number;
            ENOTSUP: number;
            EOVERFLOW: number;
            EPERM: number;
            EPIPE: number;
            EPROTO: number;
            EPROTONOSUPPORT: number;
            EPROTOTYPE: number;
            ERANGE: number;
            EROFS: number;
            ESHUTDOWN: number;
            ESPIPE: number;
            ESRCH: number;
            ETIMEDOUT: number;
            ETXTBSY: number;
            EXDEV: number;
            UNKNOWN: number;
            EOF: number;
            ENXIO: number;
            EMLINK: number;
            EHOSTDOWN: number;
            EREMOTEIO: number;
            ENOTTY: number;
            EFTYPE: number;
            EILSEQ: number;
            ESOCKTNOSUPPORT: number;

           /**
            * Returns the string representing the given error number.
            *
            * @param code Error number.
            */
            strerror(errno: number): string;
        }

        /**
        * Error type. It mostly encapsulates the libuv errors.
        * The available error number properties depends on the platform.
        */
        class Error {
            
            constructor(errno: number);

            /**
            * The error code.
            */
            code: string;

            /**
            * The represented error number.
            */
            errno: number;
            
            /**
            * The error string representation.
            */
            message: string;
        }

        const errors: IErrors;

        /**
        * Returns the canonicalized absolute pathname.
        *
        * @param path Path to convert.
        */
        function realpath(path: string): Promise<string>;
        
        /**
        * Removes the given file.
        *
        * @param path Path to be removed.
        */
        function unlink(path: string): Promise<void>;
        
        /**
        * Renames the given path.
        *
        * @param path Current path.
        * @param newPath New desired path name.
        */
        function rename(path: string, newPath: string): Promise<void>;
        
        /**
        * Create a unique temporary directory. The given template must end in XXXXXX, and the Xs will
        * be replaced to provide a unique directory name.
        *
        * ```js
        * const tmpDir = await tjs.mkdtemp('tmpDirXXXXXX');
        * ```
        * @param template Template for the directory.
        */
        function mkdtemp(template: string): Promise<string>;
        
        /**
        * Create a unique temporary file. The given template must end in XXXXXX, and the Xs will
        * be replaced to provide a unique file name. The returned object is an open file handle.Handle
        *
        * @param template Template for the file name.
        */
        function mkstemp(template: string): Promise<FileHandle>;
        
        interface FileHandle {
            /**
            * Reads data into the given buffer at the given file offset. Returns
            * the amount of read data or null for EOF.
            *
            * @param buffer Buffer to read data into.
            * @param offset Offset in the file to read from.
            */
            read(buffer: Uint8Array, offset?: number): Promise<number|null>;
            
            /**
            * Writes data from the given buffer at the given file offset. Returns
            * the amount of data written.
            *
            * @param buffer Buffer to write.
            * @param offset Offset in the file to write to.
            */
            write(buffer: Uint8Array, offset?: number): Promise<number>;
            
            /**
            * Closes the file.
            */
            close(): Promise<void>;
            
            /**
            * Get the file status information.
            * See [stat(2)](https://man7.org/linux/man-pages/man2/lstat.2.html)
            */
            stat(): Promise<StatResult>;
            
            /**
            * Truncates the file to the given length.
            *
            * @param offset Length to truncate the file to.
            */
            truncate(offset?: number): Promise<void>;
            
            /**
            * See [fdatasync(2)](https://man7.org/linux/man-pages/man2/fdatasync.2.html)
            */
            datasync(): Promise<void>;
            
            /**
            * See [fsync(2)](https://man7.org/linux/man-pages/man2/fdatasync.2.html)
            */
            sync(): Promise<void>;
            
            /**
            * The file path.
            */
            path: string;
            
            readable: ReadableStream<Uint8Array>;
            writable: WritableStream<Uint8Array>;
        }
        
        interface StatResult {
            dev: number;
            mode: number;
            nlink: number;
            uid: number;
            gid: number;
            rdev: number;
            ino: number;
            size: number;
            blksize: number;
            blocks: number;
            atim: Date;
            mtim: Date;
            ctim: Date;
            birthtim: Date;
            isBlockDevice: boolean;
            isCharacterDevice: boolean;
            isDirectory: boolean;
            isFIFO: boolean;
            isFile: boolean;
            isSocket: boolean;
            isSymbolicLink: boolean;
        }
        
        /**
        * Flag used to check in {@link StatResult}'s `st_mode` field.
        * See [stat(2)](https://man7.org/linux/man-pages/man2/lstat.2.html)
        * Available values:
        */
        const S_IFMT: number;
        const S_IFIFO: number;
        const S_IFCHR: number;
        const S_IFDIR: number;
        const S_IFBLK: number;
        const S_IFREG: number;
        const S_IFSOCK: number;
        const S_IFLNK: number;
        const S_ISGID: number;
        const S_ISUID: number;

        /**
        * Gets file status information.
        * See [stat(2)](https://man7.org/linux/man-pages/man2/stat.2.html)
        *
        * @param path Path to the file.
        */
        function stat(path: string): Promise<StatResult>;
        
        /**
        * Gets file status information. If the path is a link it returns information
        * about the link itself.
        * See [stat(2)](https://man7.org/linux/man-pages/man2/stat.2.html)
        *
        * @param path Path to the file.
        */
        function lstat(path: string): Promise<StatResult>;
        
        /**
        * Change permissions of a file.
        * See [chmod(2)](https://man7.org/linux/man-pages/man2/chmod.2.html)
        *
        * @param path Path to the file.
        * @param mode The file mode consisting of permission, suid, sgid, and sticky bits.
        */
        function chmod(path: string, mode: number): Promise<void>;
        
        /**
        * Change the ownership of a file.
        * See [chown(2)](https://man7.org/linux/man-pages/man2/chown.2.html)
        *
        * @param path Path to the file.
        * @param owner The uid to change the file's owner to.
        * @param group The gid to change the file's group to.
        */
        function chown(path: string, owner: number, group: number): Promise<void>;
        
        /**
        * Change the ownership of a file. If the path is a link it changes
        * the ownership of the link itself.
        * See [lchown(2)](https://man7.org/linux/man-pages/man2/lchown.2.html)
        *
        * @param path Path to the file.
        * @param owner The uid to change the file's owner to.
        * @param group The gid to change the file's group to.
        */
        function lchown(path: string, owner: number, group: number): Promise<void>;
        
        /**
        * Opens the file at the given path. Opening flags:
        *
        *   - r: open for reading
        *   - w: open for writing, truncating the file if it exists
        *   - x: open with exclusive creation, will fail if the file exists
        *   - a: open for writing, appending at the end if the file exists
        *   - +: open for updating (reading and writing)
        *
        * ```js
        * const f = await tjs.open('file.txt', 'r');
        * ```
        * @param path The path to the file to be opened.
        * @param flags Flags with which to open the file.
        * @param mode File mode bits applied if the file is created. Defaults to `0o666`.
        */
        function open(path: string, flags: string, mode?: number): Promise<FileHandle>;
        
        /**
        * Removes the directory at the given path.
        *
        * @param path Directory path.
        */
        function rmdir(path: string): Promise<void>;
        
        interface MkdirOptions {
            /* The file mode for the new directory. Defaults to `0o777`. */
            mode?: number;
            /* Whether the directories will be created recursively or not. */
            recursive?: boolean;
        }

        /**
        * Create a directory at the given path.
        *
        * @param path The path to of the directory to be created.
        * @param options Options for making the directory.
        */
        function mkdir(path: string, options?: MkdirOptions): Promise<void>;
        
        /**
        * Copies the source file into the target.
        *
        * If `COPYFILE_EXCL` is specified the operation will fail if the target exists.
        *
        * If `COPYFILE_FICLONE` is specified it will attempt to create a reflink. If
        * copy-on-write is not supported, a fallback copy mechanism is used.
        *
        * If `COPYFILE_FICLONE_FORCE` is specified it will attempt to create a reflink.
        * If copy-on-write is not supported, an error is thrown.
        *
        * @param path Source path.
        * @param newPath Target path.
        * @param flags Specify the mode for copying the file.
        */
        function copyfile(path: string, newPath: string, flags?: number): Promise<void>;
        
        interface DirEnt {
            name: string;
            isBlockDevice: boolean;
            isCharacterDevice: boolean;
            isDirectory: boolean;
            isFIFO: boolean;
            isFile: boolean;
            isSocket: boolean;
            isSymbolicLink: boolean;
        }
        
        /**
        * Directory entries can be obtained through asynchronous iteration:
        *
        * ```js
        * const dirIter = await tjs.readdir('.');
        * for await (const item of dirIter) {
        *     console.log(item.name);
        * }
        * ```
        */
        interface DirHandle extends AsyncIterableIterator<DirEnt> {
            
            /**
            * Closes the directory handle.
            */
            close(): Promise<void>;
            
            /**
            * Path of the directory.
            */
            path: string;
        }
        
        /**
        * Open the directory at the given path in order to navigate its content.
        * See [readdir(3)](https://man7.org/linux/man-pages/man3/readdir.3.html)
        *
        * @param path Path to the directory.
        */
        function readdir(path: string): Promise<DirHandle>;
        
        /**
        * Reads the entire contents of a file.
        *
        * @param path File path.
        */
        function readFile(path: string): Promise<Uint8Array>;

        /**
         * Recursively delete files and directories at the given path.
         * Equivalent to POSIX "rm -rf".
         *
         * @param path Path to be removed.
         */
        function rm(path: string): Promise<void>;

        /**
        * File watch event handler function.
        */
        type WatchEventHandler = (filename: string, event: 'change' | 'rename') => void;
        
        interface FileWatcher {
            /**
            * Closes the watcher.
            */
            close(): void;
            
            /**
            * Path which is currently being watched.
            */
            path: string;
        }
        
        /**
        * Watches the given path for changes.
        *
        * @param path The path to watch.
        * @param handler Function to be called when an event occurs.
        */
        function watch(path: string, handler: WatchEventHandler): FileWatcher;
        
        interface Uname {
            sysname: string;
            release: string;
            version: string;
            machine: string;
        }
        
        /**
        * Obtain system information.
        */
        function uname(): Uname;
        
        /**
        * Get system uptime.
        */
        function uptime(): number;
        
        /**
        * Returns the current user's home directory.
        */
        function homedir(): string;
        
        /**
        * Returns the temporary directory.
        */
        function tmpdir(): string;
        
        /**
        * Gets the system load average.
        * See [getloadavg(3)](https://man7.org/linux/man-pages/man3/getloadavg.3.html)
        */
        function loadavg(): [ number, number, number ];
        
        interface CpuTimes {
            user: number;
            nice: number;
            sys: number;
            idle: number;
            irq: number;
        }
        
        interface CpuInfo {
            model: string;
            speed: number;
            times: CpuTimes;
        }
        
        /**
        * Gets information about the CPUs in the system.
        */
        function cpuInfo(): CpuInfo[];
        
        interface NetworkInterface {
            name: string;
            address: string;
            mac: string;
            scopeId?: number;
            netmask: string;
            internal: boolean;
        }
        
        /**
        * Gets information about the network interfaces in the system.
        */
        function networkInterfaces(): NetworkInterface[];
        
        type StdioType = 'tty' | 'pipe' | 'file';
        
        interface StdioInputStream extends Reader {
            isTTY: boolean;
            type: StdioType;
            setRawMode(enable: boolean): void;
        }
        
        interface StdioOutputStream extends Writer {
            isTTY: boolean;
            type: StdioType;
            height: number;
            width: boolean;
        }
        
        /**
        * Object providing access to standard input.
        */
        const stdin: StdioInputStream;
        
        /**
        * Object providing access to standard output.
        */
        const stdout: StdioOutputStream;
        
        /**
        * Object providing access to standard error.
        */
        const stderr: StdioOutputStream;
        
        interface ProcessStatus {
            exit_status: number;
            term_signal: Signal|null;
        }
        
        interface Process {
            kill(signal?: Signal): void;
            wait(): Promise<ProcessStatus>;
            pid: number;
            stdin?: Writer;
            stdout?: Reader;
            stderr?: Reader;
        }
        
        type ProcessStdio = 'inherit' | 'pipe' | 'ignore';
        
        interface ProcessOptions {
            env?: Environment;
            cwd?: string;
            uid?: number;
            gid?: number;
            stdin?: ProcessStdio;
            stdout?: ProcessStdio;
            stderr?: ProcessStdio;
        }
        
        /**
        * Spawn a child process.
        *
        * @param args Command line arguments for the new process.
        * @param options Extra options.
        */
        function spawn(args: string | string[], options?: ProcessOptions): Process;
        
        /**
        * Replace the current process image with a new process image.
        * This function does not return if successful.
        *
        * See [execvp(3)](https://man7.org/linux/man-pages/man3/execvp.3.html)
        *
        * @param args Command argument list for the new process image.
        */
        function exec(args: string | string[]): void;
        
        interface Address {
            family: number;
            ip: string;
            port: number;
            scopeId?: number;
            flowinfo?: number;
        }
        
        interface Connection {
            read(buf: Uint8Array): Promise<number|null>;
            write(buf: Uint8Array): Promise<number>;
            setKeepAlive(enable: boolean, delay: number): void;
            setNoDelay(enable?: boolean): void;
            shutdown(): void;
            close(): void;
            localAddress: Address;
            remoteAddress: Address;
            readable: ReadableStream<Uint8Array>;
            writable: WritableStream<Uint8Array>;
        }
        
        interface DatagramData {
            nread: number;
            partial: boolean;
            addr: Address;
        }
        
        interface DatagramEndpoint {
            recv(buf: Uint8Array): Promise<number>;
            send(buf: Uint8Array, addr?: Address): Promise<DatagramData>;
            close(): void;
            localAddress: Address;
            remoteAddress: Address;
        }
        
        type Transport = 'tcp' | 'udp' | 'pipe';
        
        interface ConnectOptions {
            /**
            * Local address to bind to.
            */
            bindAddr: Address;
            
            /**
            * Disables dual stack mode.
            */
            ipv6Only?: boolean;
        }
        
        /**
        * Creates a connection to the target host + port over the selected transport.
        *
        * @param transport Type of transport for the connection.
        * @param host Hostname for the connection. Basic lookup using {@link getaddrinfo} will be performed.
        * @param port Destination port (where applicable).
        * @param options Extra connection options.
        */
        function connect(transport: Transport, host: string, port?: string | number, options?: ConnectOptions): Promise<Connection | DatagramEndpoint>;
        
        interface Listener extends AsyncIterable<Connection> {
            accept(): Promise<Connection>;
            close(): void;
            localAddress: Address;
        }
        
        interface ListenOptions {
            backlog?: number;
            
            /**
            * Disables dual stack mode.
            */
            ipv6Only?: boolean;
            
            /**
            * Used on UDP only.
            * Enable address reusing (when binding). What that means is that
            * multiple threads or processes can bind to the same address without error
            * (provided they all set the flag) but only the last one to bind will receive
            * any traffic, in effect "stealing" the port from the previous listener.
            */
            reuseAddr?: boolean;
        }
        
        /**
        * Listens for incoming connections on the selected transport.
        *
        * @param transport Transport type.
        * @param host Hostname for listening on.
        * @param port Listening port (where applicable).
        * @param options Extra listen options.
        */
        function listen(transport: Transport, host: string, port?: string | number, options?: ListenOptions): Promise<Listener | DatagramEndpoint>;
        
        /**
        * Current process ID.
        */
        const pid: number;
        
        /**
        * Parent process ID.
        */
        const ppid: number;
        
        interface UserInfo {
            username: string;
            uid: number;
            gid: number;
            shell: string | null;
            homedir: string | null;
        }
        
        /**
        * Retrieves user information from the password database.
        */
        function userInfo(): UserInfo;
        
        /**
        * Returns an estimate of the default amount of parallelism a program should use.
        */
        function availableParallelism(): number;
        
        /**
        * provides access to most of the POSIX socket API.
        * It can be listened to with poll (libuv poll)
        * *not available on windows*
        */
        class PosixSocket{
            constructor(domain: number, type: number, protocol: number);
            
            readonly info: {
                socket?: {domain: number, type: number, protocol: number}
            };
            
            static readonly defines: {
                AF_INET: number,
                AF_INET6: number,
                AF_NETLINK: number,
                AF_PACKET: number,
                
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
            };
            static createFromFD(fd: number): PosixSocket;
            
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

    interface ConsolePrinterOptions {
        /** output message to stderr instead of stdout */
        isWarn?: boolean;

        /** how much to indent the message (level of groups) */
        indent: number;
    }

    /**
    * Returns an estimate of the default amount of parallelism a program should use.
    */
    function createConsole(opts: {
        /** function to print messages to somewhere, see https://console.spec.whatwg.org/#printer */
        printer: (logLevel: string, args: any[], options: ConsolePrinterOptions) => void,
        /** function to handle normal log messages, see https://console.spec.whatwg.org/#logger */
        logger?: (logLevel: string, args: any[], options: ConsolePrinterOptions) => void,
        /** function to clear the console, e.g. send the ASCII ctrl character */
        clearConsole?: () => void,
        /** format given values, either by using a format string as first param or otherwise display values in a well readable format, see https://console.spec.whatwg.org/#formatter */
        formatter?: (args: any[]) => string,
        /** format js values to be well readable */
        inspect?: (args: any[]) => string,
    }): typeof console;

    /**
     * format any js value to be well readable
     * @returns resulting string
     */
    function inspect(value: any, options?: { depth?: number, colors?: boolean, showHidden?: boolean }): string;

    /**
     * print format string and insert given values, see https://console.spec.whatwg.org/#formatter
     * leftover values are appended to the end
     * @returns resulting string
     */
    function format(format: string, ...args: any[]): string;

    /**
     * format given values to a well readable string 
     * @returns resulting string
     */
    function format(...values: any[]): string;
}

export {};
