/**
 * Utilities for working with paths.
 * This module is an adaptation of the [NodeJS path module](https://nodejs.org/docs/latest-v18.x/api/path.html).
 *
 * @module tjs:path
 */

declare module 'tjs:path'{
    export interface IPathObject {
        dir: string;
        root: string;
        base: string;
        name: string;
        ext: string;
    }

    export interface IPath {
        readonly delimiter: string;
        readonly sep: string;

        basename(path: string): string;
        dirname(path: string): string;
        extname(path: string): string;
        format(pathObj: IPathObject): string;
        isAbsolute(path: string): boolean;
        join(...paths: string[]): string;
        normalize(path: string): string;
        parse(path: string): IPathObject;
        relative(from: string, to: string): string;
        resolve(...paths: string[]): string;
        toNamespacedPath(path: string): string;
    }

    export const posix: IPath;
    export const win32: IPath;

    const path: IPath;
    export default path;
}
