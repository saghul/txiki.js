/**
 * The single global where all txiki.js APIs are exposed.
 */
declare namespace tjs {
    /**
     * Implemented by entities from which data can be read.
     */
    interface Reader {
        /**
         * Reads data into the given buffer. Resolves to the number of read bytes.
         *
         * @param buf Buffer to read data into.
         */
        read(buf: Uint8Array): Promise<number>;
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

    /**
     * Signal handler function.
     */
    type SignalHandler = () => void;

    /**
     * Registers a handler for the given signal.
     *
     * ```js
     * const h = tjs.signal('SIGINT', handleSigint);
     * ```
     *
     * @param sig Which signal to register a handler for.
     * @param handler Handler function.
     */
    function signal(sig: string, handler: SignalHandler): void;

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
     */
    type Environment = { [index: string]: string };

    /**
     * System environment variables.
     */
    const environ: Environment;

    /**
     * Gets the environment variable of the given name.
     *
     * @param name Name of the environment variable to get.
     */
    function getenv(name: string): string;

    /**
     * Sets the given environment variable to the given value.
     *
     * @param name Name of the environment variable to be set.
     * @param value Value to be set to.
     */
    function setenv(name: string, value: string): void;

    /**
     * Unsets the given environment variable.
     *
     * @param name Name of the environment variable to unset.
     */
    function unsetenv(name: string): void;

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
     * Gets the current working directory.
     */
    function cwd(): string;

    /**
     * Constants describing a socket family.
     * Available values:
     *
     *   - AF_INET
     *   - AF_INET6
     *   - AF_UNSPEC
     */
    const AF_XXX: number;

    /**
     * Constants to be used with {@link getaddrinfo}'s `hints` parameter.
     * Available values:
     *
     *   - SOCK_STREAM
     *   - SOCK_DGRAM
     */
    const SOCK_XXX: number;

    /**
     * Constants to be used with {@link getaddrinfo}'s `hints` parameter.
     * Available values:
     *
     *   - IPPROTO_TCP
     *   - IPPROTO_UDP
     */
    const IPPROTO_XXX: number;

    /**
     * Constants to be used with {@link getaddrinfo}'s `hints` parameter.
     */
    const AI_PASSIVE: number;

    /**
     * Constant to be used with {@link getaddrinfo}'s `hints` parameter.
     * Available values:
     *
     *   - AI_CANONNAME
     *   - AI_NUMERICHOST
     *   - AI_V4MAPPED
     *   - AI_ALL
     *   - AI_ADDRCONFIG
     *   - AI_NUMERICSERV
     */
    const AI_XXX: number;

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

    /**
     * Error type. It mostly encapsulates the libuv and other platform library errors.
     */
    interface ErrorType {
        /**
         * Error code constants.
         */
        EXXX: number;

        /**
         * Returns the string representing the given error code.
         *
         * @param code Error code.
         */
        strerror(code: number): string;

        /**
         * On a specific instance, the represented error code.
         */
        code: number;

        /**
         * On a specific instance, the error string representation.
         */
        message: string;
    }

    const Error: ErrorType;

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
         * the amount of read data.
         *
         * @param buffer Buffer to read data into.
         * @param offset Offset in the file to read from.
         */
        read(buffer: Uint8Array, offset?: number): Promise<number>;

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
        st_dev: number;
        st_mode: number;
        st_nlink: number;
        st_uid: number;
        st_gid: number;
        st_rdev: number;
        st_ino: number;
        st_size: number;
        st_blksize: number;
        st_blocks: number;
        st_flags: number;
        st_gen: number;
        st_atim: number;
        st_mtim: number;
        st_ctim: number;
        st_birthtim: number;
    }

    /**
     * Flag used to check in {@link StatResult}'s `st_mode` field.
     * See [stat(2)](https://man7.org/linux/man-pages/man2/lstat.2.html)
     * Available values:
     *
     *   - S_IFMT
     *   - S_IFIFO
     *   - S_IFCHR
     *   - S_IFDIR
     *   - S_IFBLK
     *   - S_IFREG
     *   - S_IFSOCK
     *   - S_IFLNK
     *   - S_ISGID
     *   - S_ISUID
     */
    const S_XXX: number;

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
     * Opens the file at the given path. Opening modes:
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
     * @param mode Mode in which to open the file.
     */
    function open(path: string, mode: string): Promise<FileHandle>;

    /**
     * Removes the directory at the given path.
     *
     * @param path Directory path.
     */
    function rmdir(path: string): Promise<void>;

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

    /**
     * Constants representing directory entry types. To be used with {@link DirEnt}'s
     * `type` field.
     * Available values:
     *
     *   - DIRENT_UNKNOWN
     *   - DIRENT_FILE
     *   - DIRENT_DIR
     *   - DIRENT_LINK
     *   - DIRENT_FIFO
     *   - DIRENT_SOCKET
     *   - DIRENT_CHAR
     *   - DIRENT_BLOCK
     */
    const DIRENT_XXX: number;

    interface DirEnt {
        name: string;
        type: number;
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
    interface DirHandle extends AsyncIterator<DirEnt> {
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
     * File watch event handler function. Event types:
     *
     *   - FS_EVENT_CHANGE
     *   - FS_EVENT_RENAME
     */
    type WatchEventHandler = (filename: string, events: number) => void;

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
        scopeId?: number;
        netmask: string;
        internal: boolean;
    }

    /**
     * Gets information about the network interfaces in the system.
     */
    function networkInterfaces(): NetworkInterface[];

    interface StdioInputStream extends Reader {
        isTTY: boolean;
        setRawMode(enable: boolean): void;
    }

    interface StdioOutputStream extends Writer {
        isTTY: boolean;
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
        term_signal: string;
    }

    interface Process {
        kill(signal?: string): void;
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

    interface Address {
        family: number;
        ip: string;
        port: number;
        scopeId?: number;
        flowinfo?: number;
    }

    interface Connection {
        read(buf: Uint8Array): Promise<number>;
        write(buf: Uint8Array): Promise<number>;
        setKeepAlive(enable?: boolean): void;
        setNoDelay(enable?: boolean): void;
        shutdown(): void;
        close(): void;
        localAddress: Address;
        remoteAddress: Address;
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
    }

    /**
     * Indicates dual stack mode will be disabled. Can be passed when
     * selecting the bind address, as a bind flag.
     */
    const UDP_IPV6ONLY: number;

    /**
     * Indicates message was truncated because read buffer was too small.
     */
    const UDP_PARTIAL: number;

    /**
     * Enable address reusing (when binding). What that means is that
     * multiple threads or processes can bind to the same address without error
     * (provided they all set the flag) but only the last one to bind will receive
     * any traffic, in effect "stealing" the port from the previous listener.
     */
    const UDP_REUSEADDR: number;

    interface DatagramData {
        nread: number;
        flags: number;
        addr: Address;
    }

    interface DatagramEndpoint {
        recv(buf: Uint8Array): Promise<number>;
        send(buf: Uint8Array, addr?: Address): Promise<DatagramData>;
        close(): void;
        localAddress: Address;
        remoteAddress: Address;
    }

    /**
     * Indicates dual stack mode will be disabled. Can be passed when
     * selecting the bind address, as a bind flag.
     */
    const TCP_IPV6ONLY: number;

    type Transport = 'tcp' | 'udp' | 'pipe';

    interface ConnectOptions {
        /**
         * Local address to bind to.
         */
        bindAddr: Address;

        /**
         * Bind flags.
         */
        bindFlags: number;
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
        backlog: number;

        /**
         * Bind flags.
         */
        bindFlags: number;
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
}
