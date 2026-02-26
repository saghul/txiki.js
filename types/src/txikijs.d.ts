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
        * Alerts the user about something.
        *
        * @category Utilities
        * @param msg The message that will be displayed.
        */
        function alert(msg:string): Promise<void>;

        /**
        * Asks the user for confirmation.
        *
        * @category Utilities
        * @param msg The message which will be printed as the question. Defaults to "Confirm".
        */
        function confirm(msg:string): Promise<boolean>;

        /**
        * Prompt the user for input.
        *
        * @category Utilities
        * @param msg Message to ask the user.
        * @param def Default value in case nothing was entered.
        */
        function prompt(msg:string, def?:string): Promise<string|null>;

        /**
        * Array with the arguments passed to the binary.
        *
        * @category System
        */
        const args: readonly string[];

        /**
        * @category Process
        */
        type Signal = 'SIGHUP' | 'SIGINT' | 'SIGQUIT' | 'SIGILL' | 'SIGTRAP'
        | 'SIGABRT' | 'SIGBUS' | 'SIGFPE' | 'SIGKILL' | 'SIGUSR1' | 'SIGSEGV'
        | 'SIGUSR2' | 'SIGPIPE' | 'SIGALRM' | 'SIGTERM' | 'SIGSTKFLT'
        | 'SIGCHLD' | 'SIGCONT' | 'SIGSTOP' | 'SIGTSTP' | 'SIGTTIN' | 'SIGTTOU'
        | 'SIGURG' | 'SIGXCPU' | 'SIGXFSZ' | 'SIGVTALRM' | 'SIGPROF' | 'SIGWINCH'
        | 'SIGPOLL' | 'SIGPWR' | 'SIGSYS';

        /**
        * Signal listener function.
        *
        * @category Process
        */
        type SignalListener = () => void;

        /**
        * Registers a listener for the given signal.
        *
        * ```js
        * tjs.addSignalListener('SIGINT', handleSigint);
        * ```
        *
        * @category Process
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
        * @category Process
        * @param sig Which signal to un-register a listener for.
        * @param listener Listener function.
        */
        function removeSignalListener(sig: Signal, listener: SignalListener): void;

        /**
        * Send a signal to a process.
        *
        * @category Process
        * @param pid The pid of the process to send a signal to.
        * @param sig The name of the signal to send. Defaults to "SIGTERM".
        */
        function kill(pid: number, sig?: Signal): void;

        /**
        * @category Engine
        */
        type CompiledCode = unknown;

        /**
        * @namespace
        * @category Engine
        */
        const engine : {
            /**
             * Compiles the provided code into bytecode ready to be evaluated or serialized.
             *
             * @param code The code to be compiled.
             * @returns The compiled code.
             */
            compile: (code: Uint8Array) => CompiledCode;

            /**
             * Serializes the compiled code into something that can be easily written to a file.
             *
             * @param compiledCode The compiled code that needs to be serialized.
             * @returns Serialized bytecode.
             */
            serialize: (compiledCode: CompiledCode) => Uint8Array;

            /**
             * Deserializes the given bytecode.
             *
             * @param bytes The serialized bytecode.
             * @returns The de-serialized code.
             */
            deserialize: (bytes: Uint8Array) => CompiledCode;

            /**
             * Executes the given compiled code.
             *
             * @param code Pre-compiled code that needs to be executed.
             * @returns A `Promise` resolving to the value returned by the code, if any.
             */
            evalBytecode: (code: CompiledCode) => Promise<unknown>;

            /**
            * Management for the garbage collection.
            */
            readonly gc: {
                /**
                 * Force garbage collection now.
                 */
                run: () => void;

                /**
                 * Enables / disables automatic garbage collection.
                 */
                enabled: boolean;

                /**
                 * Sets / gets the threshold (in bytes) for automatic garbage collection.
                 */
                threshold: number;
            }

            /**
            * Versions of all included libraries and txiki.js itself.
            */
            readonly versions: {
                readonly quickjs: string;
                readonly tjs: string;
                readonly uv: string;
                readonly wasm3: string;
                readonly sqlite3: string;
                readonly mimalloc?: string;
            };
        }

        /**
        * The txiki.js version.
        *
        * @category System
        */
        const version: string;

        /**
        * Full path to the txiki.js running executable.
        *
        * @category System
        */
        const exePath: string;

        /**
        * Object containing environment variables.
        * Setting and deleting properties on this object causes
        * environment variables to be set / deleted.
        *
        * @category System
        */
        type Environment = { [index: string]: string };

        /**
        * System environment variables.
        *
        * @category System
        */
        const env: Environment;

        /**
        * Current system host name.
        *
        * @category System
        */
        const hostName: string;

        /**
        * Exit the current running program.
        *
        * @category Process
        * @param code Program exit code.
        */
        function exit(code: number): void;

        /**
        * Changes the current working directory.
        *
        * @category System
        */
        function chdir(dir: string): void;

        /**
        * Current working directory.
        *
        * @category System
        */
        const cwd: string;

        /**
        * Result type for {@link lookup}.
        *
        * @category Networking
        */
        interface Addr {
            family: number;
            ip: string;
        }

        /**
        * @category Networking
        */
        interface LookupOptions {
            /**
             * Resolve only the given family results.
             */
            family?: number;

            /**
             * If set to `true` returns all the results, it just returns the first one otherwise (default).
             */
            all?: boolean;
        }

        /**
        * Basic DNS resolution using [getaddrinfo(3)](https://man7.org/linux/man-pages/man3/getaddrinfo.3.html).
        *
        * @category Networking
        * @param host Hostname to be looked up.
        * @param options Criteria for selecting the results.
        */
        function lookup(host: string, options?: LookupOptions): Promise<Addr|Addr[]>;

        /**
        * Error type. It mostly encapsulates the libuv errors.
        *
        * @category Utilities
        */
        class Error {

            constructor(errno: number);

            /**
            * The system error code as a string. For example `EPERM`.
            */
            code: string;

            /**
            * The error string representation in the form `code: description`.
            */
            message: string;
        }

        /**
        * Returns the canonicalized absolute pathname.
        *
        * @category Filesystem
        * @param path Path to convert.
        */
        function realPath(path: string): Promise<string>;

        /**
        * Renames the given path.
        *
        * @category Filesystem
        * @param path Current path.
        * @param newPath New desired path name.
        */
        function rename(path: string, newPath: string): Promise<void>;

        /**
        * Create a unique temporary directory. The given template must end in XXXXXX, and the Xs will
        * be replaced to provide a unique directory name.
        *
        * ```js
        * const tmpDir = await tjs.makeTempDir('tmpDirXXXXXX');
        * ```
        *
        * @category Filesystem
        * @param template Template for the directory.
        */
        function makeTempDir(template: string): Promise<string>;

        /**
        * Create a unique temporary file. The given template must end in XXXXXX, and the Xs will
        * be replaced to provide a unique file name. The returned object is an open file handle.
        *
        * @category Filesystem
        * @param template Template for the file name.
        */
        function makeTempFile(template: string): Promise<FileHandle>;

        /**
        * @category Filesystem
        */
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
            * Change permissions of the file.
            * See [fchmod(2)](https://man7.org/linux/man-pages/man2/fchmod.2.html)
            *
            * @param mode The file mode consisting of permission, suid, sgid, and sticky bits.
            */
            chmod(mode: number): Promise<void>;

            /**
             * Change the access and modification time of the file.
             * See [futimes(2)](https://man7.org/linux/man-pages/man2/futimes.2.html)
             *
             * @param atime The new file access time.
             * @param mtime The new file modification time.
             */
            utime(atime: Date, mtime: Date): Promise<void>;

            /**
            * The file path.
            */
            path: string;

            readable: ReadableStream<Uint8Array>;
            writable: WritableStream<Uint8Array>;
        }

        /**
        * @category Filesystem
        */
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
        * Gets file status information.
        * See [stat(2)](https://man7.org/linux/man-pages/man2/stat.2.html)
        *
        * @category Filesystem
        * @param path Path to the file.
        */
        function stat(path: string): Promise<StatResult>;

        /**
        * Gets file status information. If the path is a link it returns information
        * about the link itself.
        * See [stat(2)](https://man7.org/linux/man-pages/man2/stat.2.html)
        *
        * @category Filesystem
        * @param path Path to the file.
        */
        function lstat(path: string): Promise<StatResult>;

        /**
        * @category Filesystem
        */
        interface StatFsResult {
            type: number;
            bsize: number;
            blocks: number;
            bfree: number;
            bavail: number;
            files: number;
            ffree: number;
        }

        /**
        * Get file-system statistics.
        * See [statfs(2)](https://man7.org/linux/man-pages/man2/statfs.2.html)
        *
        * @category Filesystem
        * @param path Path to the mount point.
        */
        function statFs(path: string): Promise<StatFsResult>;

        /**
        * Change permissions of a file.
        * See [chmod(2)](https://man7.org/linux/man-pages/man2/chmod.2.html)
        *
        * @category Filesystem
        * @param path Path to the file.
        * @param mode The file mode consisting of permission, suid, sgid, and sticky bits.
        */
        function chmod(path: string, mode: number): Promise<void>;

        /**
        * Change the ownership of a file.
        * See [chown(2)](https://man7.org/linux/man-pages/man2/chown.2.html)
        *
        * @category Filesystem
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
        * @category Filesystem
        * @param path Path to the file.
        * @param owner The uid to change the file's owner to.
        * @param group The gid to change the file's group to.
        */
        function lchown(path: string, owner: number, group: number): Promise<void>;

        /**
         * Change the access and modification time of a file.
         * See [futimes(2)](https://man7.org/linux/man-pages/man2/futimes.2.html)
         *
         * @category Filesystem
         * @param path Path to the file.
         * @param atime The new file access time.
         * @param mtime The new file modification time.
         */
        function utime(path: string, atime: Date, mtime: Date): Promise<void>;

        /**
         * Change the access and modification time of a file. If the path is a link it changes
        * the ownership of the link itself.
         * See [futimes(2)](https://man7.org/linux/man-pages/man2/futimes.2.html)
         *
         * @category Filesystem
         * @param path Path to the file.
         * @param atime The new file access time.
         * @param mtime The new file modification time.
         */
        function lutime(path: string, atime: Date, mtime: Date): Promise<void>;

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
        *
        * @category Filesystem
        * @param path The path to the file to be opened.
        * @param flags Flags with which to open the file.
        * @param mode File mode bits applied if the file is created. Defaults to `0o666`.
        */
        function open(path: string, flags: string, mode?: number): Promise<FileHandle>;

        /**
        * @category Filesystem
        */
        interface MakeDirOptions {
            /* The file mode for the new directory. Defaults to `0o777`. */
            mode?: number;
            /* Whether the directories will be created recursively or not. Default to `false`. */
            recursive?: boolean;
        }

        /**
        * Create a directory at the given path.
        *
        * @category Filesystem
        * @param path The path to of the directory to be created.
        * @param options Options for making the directory.
        */
        function makeDir(path: string, options?: MakeDirOptions): Promise<void>;

        /**
        * Copies the source file into the target.
        *
        * @category Filesystem
        * @param path Source path.
        * @param newPath Target path.
        */
        function copyFile(path: string, newPath: string): Promise<void>;

        /**
        * @category Filesystem
        */
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
        * const dirIter = await tjs.readDir('.');
        * for await (const item of dirIter) {
        *     console.log(item.name);
        * }
        * ```
        *
        * @category Filesystem
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
        * @category Filesystem
        * @param path Path to the directory.
        */
        function readDir(path: string): Promise<DirHandle>;

        /**
        * Reads the value of a symbolic link.
        * See [readlink(2)](https://man7.org/linux/man-pages/man2/readlink.2.html)
        *
        * @category Filesystem
        * @param path File path.
        */
        function readLink(path: string): Promise<string>;

        /**
        * Reads the entire contents of a file.
        *
        * @category Filesystem
        * @param path File path.
        */
        function readFile(path: string): Promise<Uint8Array>;

        /**
        * @category Filesystem
        */
        interface RemoveOptions {
            /* Amount of times to retry the operation in case it fails. Defaults to 0. */
            maxRetries?: number;
            /* Time (in milliseconds) to wait between retries. Defaults to 100. */
            retryDelay?: number;
        }

        /**
         * Recursively delete files and directories at the given path.
         * Equivalent to POSIX "rm -rf".
         *
         * @category Filesystem
         * @param path Path to be removed.
         */
        function remove(path: string, options?: RemoveOptions): Promise<void>;

        /**
         * Create a hard file link.
         * See [link(2)](https://man7.org/linux/man-pages/man2/link.2.html)
         *
         * @category Filesystem
         * @param path Source file path.
         * @param newPath Target file path.
         */
        function link(path: string, newPath: string): Promise<void>;

        /**
        * @category Filesystem
        */
        interface SymlinkOptions {
            /* TYpe of symbolic link to create. Applies to Windows only. */
            type?: 'file' | 'directory' | 'junction';
        }

        /**
         * Create a symbolic link.
         * See [symlink(2)](https://man7.org/linux/man-pages/man2/symlink.2.html)
         *
         * @category Filesystem
         * @param path Source file path.
         * @param newPath Target file path.
         * @param options Options for specifying the type (Windows only).
         */
        function symlink(path: string, newPath: string, options?: SymlinkOptions): Promise<void>;

        /**
        * File watch event handler function.
        *
        * @category Filesystem
        */
        type WatchEventHandler = (filename: string, event: 'change' | 'rename') => void;

        /**
        * @category Filesystem
        */
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
        * @category Filesystem
        * @param path The path to watch.
        * @param handler Function to be called when an event occurs.
        */
        function watch(path: string, handler: WatchEventHandler): FileWatcher;

        /**
        * The current user's home directory.
        *
        * @category System
        */
        const homeDir: string;

        /**
        * The path to the current temporary directory.
        *
        * @category System
        */
        const tmpDir: string;

        /**
        * @category System
        */
        type StdioType = 'tty' | 'pipe' | 'file';

        /**
        * @category System
        */
        interface StdioInputStream extends ReadableStream<Uint8Array> {
            isTerminal: boolean;
            type: StdioType;
            setRawMode(enable: boolean): void;
        }

        /**
        * @category System
        */
        interface StdioOutputStream extends WritableStream<Uint8Array> {
            isTerminal: boolean;
            type: StdioType;
            height: number;
            width: number;
        }

        /**
        * Object providing access to standard input.
        *
        * @category System
        */
        const stdin: StdioInputStream;

        /**
        * Object providing access to standard output.
        *
        * @category System
        */
        const stdout: StdioOutputStream;

        /**
        * Object providing access to standard error.
        *
        * @category System
        */
        const stderr: StdioOutputStream;

        /**
        * @category Process
        */
        interface ProcessStatus {
            exit_status: number;
            term_signal: Signal|null;
        }

        /**
        * @category Process
        */
        interface ProcessReadableStream extends ReadableStream<Uint8Array> {
            arrayBuffer(): Promise<ArrayBuffer>;
            bytes(): Promise<Uint8Array>;
            text(): Promise<string>;
        }

        /**
        * @category Process
        */
        interface Process {
            kill(signal?: Signal): void;
            wait(): Promise<ProcessStatus>;
            pid: number;
            stdin: WritableStream<Uint8Array> | null;
            stdout: ProcessReadableStream | null;
            stderr: ProcessReadableStream | null;
        }

        /**
        * @category Process
        */
        type ProcessStdio = 'inherit' | 'pipe' | 'ignore';

        /**
        * @category Process
        */
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
        * @category Process
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
        * @category Process
        * @param args Command argument list for the new process image.
        */
        function exec(args: string | string[]): void;

        /**
        * @category Networking
        */
        type Transport = 'tcp' | 'udp' | 'pipe';

        /**
        * @category Networking
        */
        interface ConnectOptions {
            noDelay?: boolean;
            keepAliveDelay?: number;
            dnsQueryType?: 'ipv4' | 'ipv6';
            bindAddr?: { ip: string; port: number };
            ipv6Only?: boolean;
        }

        /**
        * Creates a connection to the target host + port over the selected transport.
        * Returns the appropriate Direct Sockets object.
        *
        * @category Networking
        * @param transport Type of transport for the connection.
        * @param host Hostname for the connection. Basic lookup using {@link lookup} will be performed.
        * @param port Destination port (where applicable).
        * @param options Extra connection options.
        */
        function connect(transport: 'tcp', host: string, port: number, options?: ConnectOptions): Promise<TCPSocket>;
        function connect(transport: 'pipe', host: string): Promise<PipeSocket>;
        function connect(transport: 'udp', host: string, port: number, options?: ConnectOptions): Promise<UDPSocket>;

        /**
        * @category Networking
        */
        interface ListenOptions {
            backlog?: number;
            ipv6Only?: boolean;
            reuseAddr?: boolean;
        }

        /**
        * Listens for incoming connections on the selected transport.
        * Returns the appropriate Direct Sockets object.
        *
        * @category Networking
        * @param transport Transport type.
        * @param host Hostname for listening on.
        * @param port Listening port (where applicable).
        * @param options Extra listen options.
        */
        function listen(transport: 'tcp', host: string, port?: number, options?: ListenOptions): Promise<TCPServerSocket>;
        function listen(transport: 'pipe', host: string, options?: ListenOptions): Promise<PipeServerSocket>;
        function listen(transport: 'udp', host?: string, port?: number, options?: ListenOptions): Promise<UDPSocket>;

        /**
        * Current process ID.
        *
        * @category Process
        */
        const pid: number;

        /**
        * Parent process ID.
        *
        * @category Process
        */
        const ppid: number;

        namespace system{
            /**
            * @category System
            */
            interface UserInfo {
                userName: string;
                userId: number;
                gorupId: number;
                shell: string | null;
                homeDir: string | null;
            }

            /**
            * @category System
            */
            interface CpuTimes {
                user: number;
                nice: number;
                sys: number;
                idle: number;
                irq: number;
            }

            /**
            * @category System
            */
            interface CpuInfo {
                model: string;
                speed: number;
                times: CpuTimes;
            }

            /**
            * @category System
            */
            interface NetworkInterface {
                name: string;
                address: string;
                mac: string;
                scopeId?: number;
                netmask: string;
                internal: boolean;
            }
        }

        /**
        * @namespace
        * System information.
        *
        * @category System
        */
        const system: {
            /**
             * Machine architecture.
             */
            readonly arch: string;

            /**
            * Information about the CPUs in the system.
            */
            readonly cpus: system.CpuInfo[];

            /**
            * System load average.
            * See [getloadavg(3)](https://man7.org/linux/man-pages/man3/getloadavg.3.html)
            */
            readonly loadAvg: [ number, number, number ];

            /**
            * Information about the network interfaces in the system.
            */
            readonly networkInterfaces: system.NetworkInterface[];

            /**
             * Operating System kernel version.
             */
            readonly osRelease: string;

            /**
            * Current platform.
            */
            readonly platform: 'linux' | 'darwin' | 'windows';

            /**
            * System uptime.
            */
            readonly uptime: number;

            /**
            * Current user information from the password database.
            */
            readonly userInfo: system.UserInfo;
        }

        /**
        * @category Utilities
        */
        interface ConsolePrinterOptions {
            /** output message to stderr instead of stdout */
            isWarn?: boolean;

            /** how much to indent the message (level of groups) */
            indent: number;
        }

        /**
        * Creates a custom `console` object.
        *
        * @category Utilities
        */
        function createConsole(opts: {
            /** function to print messages to somewhere, see https://console.spec.whatwg.org/#printer */
            printer: (logLevel: string, args: unknown[], options: ConsolePrinterOptions) => void,
            /** function to handle normal log messages, see https://console.spec.whatwg.org/#logger */
            logger?: (logLevel: string, args: unknown[], options: ConsolePrinterOptions) => void,
            /** function to clear the console, e.g. send the ASCII ctrl character */
            clearConsole?: () => void,
            /** format given values, either by using a format string as first param or otherwise display values in a well readable format, see https://console.spec.whatwg.org/#formatter */
            formatter?: (args: unknown[]) => string,
            /** format js values to be well readable */
            inspect?: (args: unknown[]) => string,
        }): typeof console;

        // HTTP Server API

        /**
        * Handler function for incoming HTTP requests.
        *
        * @category HTTP Server
        */
        type FetchHandler = (request: Request, context: RequestContext) => Response | Promise<Response> | void;

        /**
        * Context object passed to the fetch handler alongside the request.
        *
        * @category HTTP Server
        */
        interface RequestContext {
            /** The server instance, useful for WebSocket upgrades. */
            server: Server;
            /** The remote client IP address. */
            remoteAddress: string;
        }

        /**
        * Options for configuring the HTTP server.
        *
        * @category HTTP Server
        */
        interface ServeOptions {
            /** Handler function called for each incoming HTTP request. */
            fetch: FetchHandler;
            /** Port to listen on. Defaults to `0` (random available port). */
            port?: number;
            /** IP address to bind to. Defaults to `'0.0.0.0'`. */
            listenIp?: string;
            /** Optional WebSocket event handlers for upgraded connections. */
            websocket?: WebSocketHandlers;
        }

        /**
        * Event handlers for WebSocket connections upgraded via {@link Server.upgrade}.
        *
        * @category HTTP Server
        */
        interface WebSocketHandlers {
            /** Called when a WebSocket connection is established. */
            open?(ws: ServerWebSocket): void;
            /** Called when a message is received. */
            message?(ws: ServerWebSocket, data: string): void;
            /** Called when the WebSocket connection is closed. */
            close?(ws: ServerWebSocket, code: number, reason: string): void;
            /** Called when an error occurs on the WebSocket connection. */
            error?(ws: ServerWebSocket, error: Error): void;
        }

        /**
        * A WebSocket connection created by upgrading an HTTP request via {@link Server.upgrade}.
        *
        * @category HTTP Server
        */
        interface ServerWebSocket {
            /** Arbitrary data associated with this connection, set via {@link UpgradeOptions.data}. */
            readonly data: unknown;
            /** Send a text message. */
            sendText(data: string): void;
            /** Send a binary message. */
            sendBinary(data: Uint8Array): void;
            /** Close the connection. */
            close(code?: number, reason?: string): void;
        }

        /**
        * Options for upgrading an HTTP request to a WebSocket connection.
        *
        * @category HTTP Server
        */
        interface UpgradeOptions {
            /** Arbitrary data to associate with the WebSocket connection, accessible as `ws.data`. */
            data?: unknown;
        }

        /**
        * An HTTP server instance.
        *
        * @category HTTP Server
        */
        interface Server {
            /** The port the server is listening on. */
            readonly port: number;
            /** Close the server. */
            close(): void;
            /**
            * Upgrade an HTTP request to a WebSocket connection. Must be called
            * synchronously inside the fetch handler.
            *
            * @param request The incoming request with an `Upgrade: websocket` header.
            * @param options Options for the WebSocket connection.
            * @returns `true` if the upgrade was successful, `false` otherwise.
            */
            upgrade(request: Request, options?: UpgradeOptions): boolean;
        }

        /**
        * Start an HTTP server.
        *
        * ```js
        * const server = tjs.serve({
        *     fetch(request) {
        *         return new Response('Hello World!');
        *     },
        *     port: 8080,
        * });
        * ```
        *
        * A shorthand is also available when only a fetch handler is needed:
        *
        * ```js
        * const server = tjs.serve((request) => new Response('Hello!'));
        * ```
        *
        * @category HTTP Server
        * @param options Server options or a fetch handler function.
        * @returns The server instance.
        */
        function serve(options: ServeOptions | FetchHandler): Server;
    }

    // Direct Sockets API
    // See https://wicg.github.io/direct-sockets/

    /**
    * @category Networking
    */
    interface TCPSocketOpenInfo {
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
        localAddress: string;
        localPort: number;
        remoteAddress: string;
        remotePort: number;
    }

    /**
    * @category Networking
    */
    interface TCPSocketOptions {
        noDelay?: boolean;
        keepAliveDelay?: number;
        dnsQueryType?: 'ipv4' | 'ipv6';
    }

    /**
    * @category Networking
    */
    class TCPSocket {
        constructor(remoteAddress: string, remotePort: number, options?: TCPSocketOptions);
        readonly opened: Promise<TCPSocketOpenInfo>;
        readonly closed: Promise<void>;
        close(): void;
    }

    /**
    * @category Networking
    */
    interface TCPServerSocketOpenInfo {
        readable: ReadableStream<TCPSocket>;
        localAddress: string;
        localPort: number;
    }

    /**
    * @category Networking
    */
    interface TCPServerSocketOptions {
        localPort?: number;
        backlog?: number;
        ipv6Only?: boolean;
    }

    /**
    * @category Networking
    */
    class TCPServerSocket {
        constructor(localAddress: string, options?: TCPServerSocketOptions);
        readonly opened: Promise<TCPServerSocketOpenInfo>;
        readonly closed: Promise<void>;
        close(): void;
    }

    /**
    * @category Networking
    */
    interface UDPMessage {
        data: Uint8Array;
        remoteAddress?: string;
        remotePort?: number;
    }

    /**
    * @category Networking
    */
    interface UDPSocketOpenInfo {
        readable: ReadableStream<UDPMessage>;
        writable: WritableStream<UDPMessage>;
        localAddress: string;
        localPort: number;
        remoteAddress?: string;
        remotePort?: number;
        multicastController: MulticastController;
    }

    /**
    * @category Networking
    */
    interface MulticastController {
        /**
         * Joins a multicast group.
         */
        joinGroup(ipAddress: string): Promise<void>;
        /**
         * Leaves a multicast group.
         */
        leaveGroup(ipAddress: string): Promise<void>;
        /**
         * A frozen array of currently joined multicast group addresses.
         */
        readonly joinedGroups: readonly string[];
    }

    /**
    * @category Networking
    */
    interface UDPSocketOptions {
        remoteAddress?: string;
        remotePort?: number;
        localAddress?: string;
        localPort?: number;
        dnsQueryType?: 'ipv4' | 'ipv6';
        reuseAddr?: boolean;
        ipv6Only?: boolean;
        /**
         * TTL for multicast packets. Each router hop decrements this value. Default is 1.
         */
        multicastTimeToLive?: number;
        /**
         * Whether packets sent to the multicast group are looped back to the sender. Default is true.
         */
        multicastLoopback?: boolean;
        /**
         * Permits address reuse, essential for multiple applications listening on the same multicast address/port. Default is false.
         */
        multicastAllowAddressSharing?: boolean;
    }

    /**
    * @category Networking
    */
    class UDPSocket {
        constructor(options: UDPSocketOptions);
        readonly opened: Promise<UDPSocketOpenInfo>;
        readonly closed: Promise<void>;
        close(): void;
    }

    /**
    * @category Networking
    */
    interface PipeSocketOpenInfo {
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
        localAddress: string;
        remoteAddress: string;
    }

    /**
    * @category Networking
    */
    class PipeSocket {
        constructor(path: string);
        readonly opened: Promise<PipeSocketOpenInfo>;
        readonly closed: Promise<void>;
        close(): void;
    }

    /**
    * @category Networking
    */
    interface PipeServerSocketOpenInfo {
        readable: ReadableStream<PipeSocket>;
        localAddress: string;
    }

    /**
    * @category Networking
    */
    interface PipeServerSocketOptions {
        backlog?: number;
    }

    /**
    * @category Networking
    */
    class PipeServerSocket {
        constructor(path: string, options?: PipeServerSocketOptions);
        readonly opened: Promise<PipeServerSocketOpenInfo>;
        readonly closed: Promise<void>;
        close(): void;
    }
}

export {};
