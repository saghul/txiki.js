/**
* SQLite3 module.
* This module borrows a lot of inspiration from [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) and
* the [Bun sqlite module](https://bun.sh/docs/api/sqlite).
*
* @module tjs:sqlite
*/
declare module 'tjs:sqlite'{
    export interface IStatement {
        /**
         * Runs the SQL statement, ignoring the result. This is commonly used for
         * CREATE, INSERT and statement of that sort.
         *
         * @param args The bound parameters for the statement.
         */
        run(...args: any[]): void;

        /**
         * Runs the SQL statement, returning an array of objects with the name of the
         * columns and matching values.
         *
         * @param args The bound parameters for the statement.
         */
        all(...args: any[]): any[];

        /**
         * Free all resources associated with this statement. No other function
         * can be called on it afterwards.
         */
        finalize(): void;

        /**
         * Stringify the statement by expanding the SQL query.
         */
        toString(): string;
    }

    export interface IDatabaseOptions {
        /**
         * Whether the database needs to be created if it doesn't exist.
         * Defaults to `true`.
         */
        create: boolean;

        /**
         * Whether the database should be open in read-only mode or not.
         * Defaults to `false`.
         */
        readOnly: boolean;
    }

    export class Database {
        /**
         * Opens a SQLite database.
         *
         * @param dbName The path of the database. Defaults to `:memory:`, which
         * opens an in-memory database.
         * @param options Options when opening the database.
         */
        constructor(dbName: string, options: IDatabaseOptions);

        /**
         * Create a prepared statement, to run SQL queries.
         *
         * @param sql - The SQL query that will run.
         */
        prepare(sql: string): IStatement;

        /**
         * Closes the database. No further operations can be performed afterwards.
         */
        close(): void;
    }
}
