import {
    CHAR_FORWARD_SLASH,
    CHAR_DOT,
    validateString,
    StringPrototypeCharCodeAt,
    StringPrototypeSlice,
    FunctionPrototypeBind,
    normalizeString,
    isPosixPathSeparator,
    formatUtil,
} from '../polyfills/path-utils';

const tjs = globalThis.tjs;

const path = {
    /**
     * path.resolve([from ...], to)
     * @param {...string} args
     * @returns {string}
     */
    resolve(...args) {
        let resolvedPath = '';
        let resolvedAbsolute = false;

        for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            const path = i >= 0 ? args[i] : tjs.cwd();

            validateString(path, 'path');

            // Skip empty entries
            if (path.length === 0) {
                continue;
            }

            resolvedPath = `${path}/${resolvedPath}`;
            resolvedAbsolute =
                StringPrototypeCharCodeAt(path, 0) === CHAR_FORWARD_SLASH;
        }

        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when tjs.cwd() fails)

        // Normalize the path
        resolvedPath = normalizeString(
            resolvedPath,
            !resolvedAbsolute,
            '/',
            isPosixPathSeparator
        );

        if (resolvedAbsolute) {
            return `/${resolvedPath}`;
        }

        return resolvedPath.length > 0 ? resolvedPath : '.';
    },

    /**
     * @param {string} path
     * @returns {string}
     */
    normalize(path) {
        validateString(path, 'path');

        if (path.length === 0) {
            return '.';
        }

        const isAbsolute =
            StringPrototypeCharCodeAt(path, 0) === CHAR_FORWARD_SLASH;
        const trailingSeparator =
            StringPrototypeCharCodeAt(path, path.length - 1) ===
            CHAR_FORWARD_SLASH;

        // Normalize the path
        path = normalizeString(path, !isAbsolute, '/', isPosixPathSeparator);

        if (path.length === 0) {
            if (isAbsolute) {
                return '/';
            }

            return trailingSeparator ? './' : '.';
        }

        if (trailingSeparator) {
            path += '/';
        }

        return isAbsolute ? `/${path}` : path;
    },

    /**
     * @param {string} path
     * @returns {boolean}
     */
    isAbsolute(path) {
        validateString(path, 'path');

        return (
            path.length > 0 &&
            StringPrototypeCharCodeAt(path, 0) === CHAR_FORWARD_SLASH
        );
    },

    /**
     * @param {...string} args
     * @returns {string}
     */
    join(...args) {
        if (args.length === 0) {
            return '.';
        }

        let joined;

        for (let i = 0; i < args.length; ++i) {
            const arg = args[i];

            validateString(arg, 'path');

            if (arg.length > 0) {
                if (joined === undefined) {
                    joined = arg;
                } else {
                    joined += `/${arg}`;
                }
            }
        }

        if (joined === undefined) {
            return '.';
        }

        return path.normalize(joined);
    },

    /**
     * @param {string} from
     * @param {string} to
     * @returns {string}
     */
    relative(from, to) {
        validateString(from, 'from');
        validateString(to, 'to');

        if (from === to) {
            return '';
        }

        // Trim leading forward slashes.
        from = path.resolve(from);
        to = path.resolve(to);

        if (from === to) {
            return '';
        }

        const fromStart = 1;
        const fromEnd = from.length;
        const fromLen = fromEnd - fromStart;
        const toStart = 1;
        const toLen = to.length - toStart;

        // Compare paths to find the longest common path from root
        const length = fromLen < toLen ? fromLen : toLen;
        let lastCommonSep = -1;
        let i = 0;

        for (; i < length; i++) {
            const fromCode = StringPrototypeCharCodeAt(from, fromStart + i);

            if (fromCode !== StringPrototypeCharCodeAt(to, toStart + i)) {
                break;
            } else if (fromCode === CHAR_FORWARD_SLASH) {
                lastCommonSep = i;
            }
        }

        if (i === length) {
            if (toLen > length) {
                if (
                    StringPrototypeCharCodeAt(to, toStart + i) ===
                    CHAR_FORWARD_SLASH
                ) {
                    // We get here if `from` is the exact base path for `to`.
                    // For example: from='/foo/bar'; to='/foo/bar/baz'
                    return StringPrototypeSlice(to, toStart + i + 1);
                }

                if (i === 0) {
                    // We get here if `from` is the root
                    // For example: from='/'; to='/foo'
                    return StringPrototypeSlice(to, toStart + i);
                }
            } else if (fromLen > length) {
                if (
                    StringPrototypeCharCodeAt(from, fromStart + i) ===
                    CHAR_FORWARD_SLASH
                ) {
                    // We get here if `to` is the exact base path for `from`.
                    // For example: from='/foo/bar/baz'; to='/foo/bar'
                    lastCommonSep = i;
                } else if (i === 0) {
                    // We get here if `to` is the root.
                    // For example: from='/foo/bar'; to='/'
                    lastCommonSep = 0;
                }
            }
        }

        let out = '';

        // Generate the relative path based on the path difference between `to`
        // and `from`.
        for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
            if (
                i === fromEnd ||
                StringPrototypeCharCodeAt(from, i) === CHAR_FORWARD_SLASH
            ) {
                out += out.length === 0 ? '..' : '/..';
            }
        }

        // Lastly, append the rest of the destination (`to`) path that comes after
        // the common path parts.
        return `${out}${StringPrototypeSlice(to, toStart + lastCommonSep)}`;
    },

    /**
     * @param {string} path
     * @returns {string}
     */
    toNamespacedPath(path) {
        // Non-op on posix systems
        return path;
    },

    /**
     * @param {string} path
     * @returns {string}
     */
    dirname(path) {
        validateString(path, 'path');

        if (path.length === 0) {
            return '.';
        }

        const hasRoot =
            StringPrototypeCharCodeAt(path, 0) === CHAR_FORWARD_SLASH;
        let end = -1;
        let matchedSlash = true;

        for (let i = path.length - 1; i >= 1; --i) {
            if (StringPrototypeCharCodeAt(path, i) === CHAR_FORWARD_SLASH) {
                if (!matchedSlash) {
                    end = i;
                    break;
                }
            } else {
                // We saw the first non-path separator
                matchedSlash = false;
            }
        }

        if (end === -1) {
            return hasRoot ? '/' : '.';
        }

        if (hasRoot && end === 1) {
            return '//';
        }

        return StringPrototypeSlice(path, 0, end);
    },

    /**
     * @param {string} path
     * @param {string} [suffix]
     * @returns {string}
     */
    basename(path, suffix) {
        if (suffix !== undefined) {
            validateString(suffix, 'ext');
        }

        validateString(path, 'path');

        let start = 0;
        let end = -1;
        let matchedSlash = true;

        if (
            suffix !== undefined &&
            suffix.length > 0 &&
            suffix.length <= path.length
        ) {
            if (suffix === path) {
                return '';
            }

            let extIdx = suffix.length - 1;
            let firstNonSlashEnd = -1;

            for (let i = path.length - 1; i >= 0; --i) {
                const code = StringPrototypeCharCodeAt(path, i);

                if (code === CHAR_FORWARD_SLASH) {
                    // If we reached a path separator that was not part of a set of path
                    // separators at the end of the string, stop now
                    if (!matchedSlash) {
                        start = i + 1;
                        break;
                    }
                } else {
                    if (firstNonSlashEnd === -1) {
                        // We saw the first non-path separator, remember this index in case
                        // we need it if the extension ends up not matching
                        matchedSlash = false;
                        firstNonSlashEnd = i + 1;
                    }

                    if (extIdx >= 0) {
                        // Try to match the explicit extension
                        if (
                            code === StringPrototypeCharCodeAt(suffix, extIdx)
                        ) {
                            if (--extIdx === -1) {
                                // We matched the extension, so mark this as the end of our path
                                // component
                                end = i;
                            }
                        } else {
                            // Extension does not match, so our result is the entire path
                            // component
                            extIdx = -1;
                            end = firstNonSlashEnd;
                        }
                    }
                }
            }

            if (start === end) {
                end = firstNonSlashEnd;
            } else if (end === -1) {
                end = path.length;
            }

            return StringPrototypeSlice(path, start, end);
        }

        for (let i = path.length - 1; i >= 0; --i) {
            if (StringPrototypeCharCodeAt(path, i) === CHAR_FORWARD_SLASH) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // path component
                matchedSlash = false;
                end = i + 1;
            }
        }

        if (end === -1) {
            return '';
        }

        return StringPrototypeSlice(path, start, end);
    },

    /**
     * @param {string} path
     * @returns {string}
     */
    extname(path) {
        validateString(path, 'path');
        let startDot = -1;
        let startPart = 0;
        let end = -1;
        let matchedSlash = true;
        // Track the state of characters (if any) we see before our first dot and
        // after any path separator we find
        let preDotState = 0;

        for (let i = path.length - 1; i >= 0; --i) {
            const code = StringPrototypeCharCodeAt(path, i);

            if (code === CHAR_FORWARD_SLASH) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    startPart = i + 1;
                    break;
                }

                continue;
            }

            if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // extension
                matchedSlash = false;
                end = i + 1;
            }

            if (code === CHAR_DOT) {
                // If this is our first dot, mark it as the start of our extension
                if (startDot === -1) {
                    startDot = i;
                } else if (preDotState !== 1) {
                    preDotState = 1;
                }
            } else if (startDot !== -1) {
                // We saw a non-dot and non-path separator before our dot, so we should
                // have a good chance at having a non-empty extension
                preDotState = -1;
            }
        }

        if (
            startDot === -1 ||
            end === -1 ||
            // We saw a non-dot character immediately before the dot
            preDotState === 0 ||
            // The (right-most) trimmed path component is exactly '..'
            (preDotState === 1 &&
                startDot === end - 1 &&
                startDot === startPart + 1)
        ) {
            return '';
        }

        return StringPrototypeSlice(path, startDot, end);
    },

    format: FunctionPrototypeBind(formatUtil, null, '/'),

    /**
     * @param {string} path
     * @returns {{
     *   dir: string;
     *   root: string;
     *   base: string;
     *   name: string;
     *   ext: string;
     *   }}
     */
    parse(path) {
        validateString(path, 'path');

        const ret = { root: '', dir: '', base: '', ext: '', name: '' };

        if (path.length === 0) {
            return ret;
        }

        const isAbsolute =
            StringPrototypeCharCodeAt(path, 0) === CHAR_FORWARD_SLASH;
        let start;

        if (isAbsolute) {
            ret.root = '/';
            start = 1;
        } else {
            start = 0;
        }

        let startDot = -1;
        let startPart = 0;
        let end = -1;
        let matchedSlash = true;
        let i = path.length - 1;

        // Track the state of characters (if any) we see before our first dot and
        // after any path separator we find
        let preDotState = 0;

        // Get non-dir info
        for (; i >= start; --i) {
            const code = StringPrototypeCharCodeAt(path, i);

            if (code === CHAR_FORWARD_SLASH) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    startPart = i + 1;
                    break;
                }

                continue;
            }

            if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // extension
                matchedSlash = false;
                end = i + 1;
            }

            if (code === CHAR_DOT) {
                // If this is our first dot, mark it as the start of our extension
                if (startDot === -1) {
                    startDot = i;
                } else if (preDotState !== 1) {
                    preDotState = 1;
                }
            } else if (startDot !== -1) {
                // We saw a non-dot and non-path separator before our dot, so we should
                // have a good chance at having a non-empty extension
                preDotState = -1;
            }
        }

        if (end !== -1) {
            const start = startPart === 0 && isAbsolute ? 1 : startPart;

            if (
                startDot === -1 ||
                // We saw a non-dot character immediately before the dot
                preDotState === 0 ||
                // The (right-most) trimmed path component is exactly '..'
                (preDotState === 1 &&
                    startDot === end - 1 &&
                    startDot === startPart + 1)
            ) {
                ret.base = ret.name = StringPrototypeSlice(path, start, end);
            } else {
                ret.name = StringPrototypeSlice(path, start, startDot);
                ret.base = StringPrototypeSlice(path, start, end);
                ret.ext = StringPrototypeSlice(path, startDot, end);
            }
        }

        if (startPart > 0) {
            ret.dir = StringPrototypeSlice(path, 0, startPart - 1);
        } else if (isAbsolute) {
            ret.dir = '/';
        }

        return ret;
    },

    sep: '/',
    delimiter: ':',
};

export default path;
