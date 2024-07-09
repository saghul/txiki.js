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

    export interface ITransaction extends Function {
        deferred: Function;
        immediate: Function;
        exclusive: Function;
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
         * Execute the given SQL statement(s).
         *
         * @param sql - The SQL statement(s) that will run.
         */
        exec(sql: string): void;

        /**
         * Create a prepared statement, to run SQL queries.
         *
         * @param sql - The SQL query that will run.
         */
        prepare(sql: string): IStatement;

        /**
         * Wrap the given function so it runs in a [transaction](https://sqlite.org/lang_transaction.html).
         * When the (returned) function is invoked, it will start a new transaction. When the function returns,
         * the transaction will be committed. If an exception is thrown, the transaction will be rolled back.
         *
         * ```js
         * const ins = db.prepare('INSERT INTO test (txt, int) VALUES(?, ?)');
         * const insMany = db.transaction(datas => {
         *     for (const data of datas) {
         *         ins.run(data);
         *     }
         * });
         *
         * insMany([
         *     [ '1234', 1234 ],
         *     [ '4321', 4321 ],
         * ]);
         * ```
         * Transaction functions can be called from inside other transaction functions. When doing so,
         * the inner transaction becomes a [savepoint](https://www.sqlite.org/lang_savepoint.html). If an error
         * is thrown inside of a nested transaction function, the nested transaction function will roll back
         * to the state just before the savepoint. If the error is not caught in the outer transaction function,
         * this will cause the outer transaction function to roll back as well.
         *
         * Transactions also come with deferred, immediate, and exclusive versions:
         *
         * ```js
         * insertMany(datas); // uses "BEGIN"
         * insertMany.deferred(datas); // uses "BEGIN DEFERRED"
         * insertMany.immediate(datas); // uses "BEGIN IMMEDIATE"
         * insertMany.exclusive(datas); // uses "BEGIN EXCLUSIVE"
         * ```
         *
         * NOTE: This implementation was mostly taken from [better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/6acc3fcebe469969aa29319714b187a53ada0934/docs/api.md#transactionfunction---function).
         *
         * @param fn - The function to be wrapped in a transaction.
         */
        transaction(fn: Function): ITransaction;

        /**
         * Closes the database. No further operations can be performed afterwards.
         */
        close(): void;
    }
}
