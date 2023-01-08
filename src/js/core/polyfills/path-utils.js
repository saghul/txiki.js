const FunctionPrototypeBind = (func, thisArg, ...args) =>
    func.bind(thisArg, ...args);
const StringPrototypeCharCodeAt = (str, i) => str.charCodeAt(i);
const StringPrototypeIndexOf = (str, c) => str.indexOf(c);
const StringPrototypeLastIndexOf = (str, c) => str.lastIndexOf(c);
const StringPrototypeReplace = (str, regexp, val) => str.replace(regexp, val);
const StringPrototypeSlice = (str, i, j) => str.slice(i, j);
const StringPrototypeToLowerCase = str => str.toLowerCase();

// Constants

const CHAR_UPPERCASE_A = 65;
const CHAR_LOWERCASE_A = 95;
const CHAR_UPPERCASE_Z = 90;
const CHAR_LOWERCASE_Z = 122;
const CHAR_DOT = 46;
const CHAR_FORWARD_SLASH = 47;
const CHAR_BACKWARD_SLASH = 92;
const CHAR_COLON = 58;
const CHAR_QUESTION_MARK = 63;

// Validators

function validateObject(value, name) {
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
        throw new TypeError(`${name} is not an object`);
    }
}

function validateString(value, name) {
    if (typeof value !== 'string') {
        throw new TypeError(`${name} is not a string`);
    }
}

function isPathSeparator(code) {
    return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}

function isPosixPathSeparator(code) {
    return code === CHAR_FORWARD_SLASH;
}

// Resolves . and .. elements in a path with directory names
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
    let res = '';
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code = 0;

    for (let i = 0; i <= path.length; ++i) {
        if (i < path.length) {
            code = StringPrototypeCharCodeAt(path, i);
        } else if (isPathSeparator(code)) {
            break;
        } else {
            code = CHAR_FORWARD_SLASH;
        }

        if (isPathSeparator(code)) {
            if (lastSlash === i - 1 || dots === 1) {
                // NOOP
            } else if (dots === 2) {
                if (
                    res.length < 2 ||
                    lastSegmentLength !== 2 ||
                    StringPrototypeCharCodeAt(res, res.length - 1) !==
                        CHAR_DOT ||
                    StringPrototypeCharCodeAt(res, res.length - 2) !== CHAR_DOT
                ) {
                    if (res.length > 2) {
                        const lastSlashIndex = StringPrototypeLastIndexOf(
                            res,
                            separator
                        );

                        if (lastSlashIndex === -1) {
                            res = '';
                            lastSegmentLength = 0;
                        } else {
                            res = StringPrototypeSlice(res, 0, lastSlashIndex);
                            lastSegmentLength =
                                res.length -
                                1 -
                                StringPrototypeLastIndexOf(res, separator);
                        }

                        lastSlash = i;
                        dots = 0;
                        continue;
                    } else if (res.length !== 0) {
                        res = '';
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                }

                if (allowAboveRoot) {
                    res += res.length > 0 ? `${separator}..` : '..';
                    lastSegmentLength = 2;
                }
            } else {
                if (res.length > 0) {
                    res += `${separator}${StringPrototypeSlice(
                        path,
                        lastSlash + 1,
                        i
                    )}`;
                } else {
                    res = StringPrototypeSlice(path, lastSlash + 1, i);
                }

                lastSegmentLength = i - lastSlash - 1;
            }

            lastSlash = i;
            dots = 0;
        } else if (code === CHAR_DOT && dots !== -1) {
            ++dots;
        } else {
            dots = -1;
        }
    }

    return res;
}

function formatExt(ext) {
    return ext ? `${ext[0] === '.' ? '' : '.'}${ext}` : '';
}

/**
 * @param {string} sep
 * @param {{
 *  dir?: string;
 *  root?: string;
 *  base?: string;
 *  name?: string;
 *  ext?: string;
 *  }} pathObject
 * @returns {string}
 */
function formatUtil(sep, pathObject) {
    validateObject(pathObject, 'pathObject');
    const dir = pathObject.dir || pathObject.root;
    const base =
        pathObject.base ||
        `${pathObject.name || ''}${formatExt(pathObject.ext)}`;

    if (!dir) {
        return base;
    }

    return dir === pathObject.root ? `${dir}${base}` : `${dir}${sep}${base}`;
}

export {
    CHAR_UPPERCASE_A,
    CHAR_LOWERCASE_A,
    CHAR_UPPERCASE_Z,
    CHAR_LOWERCASE_Z,
    CHAR_DOT,
    CHAR_FORWARD_SLASH,
    CHAR_BACKWARD_SLASH,
    CHAR_COLON,
    CHAR_QUESTION_MARK,
    FunctionPrototypeBind,
    StringPrototypeCharCodeAt,
    StringPrototypeIndexOf,
    StringPrototypeLastIndexOf,
    StringPrototypeReplace,
    StringPrototypeSlice,
    StringPrototypeToLowerCase,
    formatUtil,
    normalizeString,
    validateString,
    isPathSeparator,
    isPosixPathSeparator,
};
