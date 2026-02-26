/* global tjs */

import path from 'tjs:path';
import { Database } from 'tjs:sqlite';


const encoder = new TextEncoder();
const stderrWriter = tjs.stderr.getWriter();

let historyDb;
let historyLoadIndex = 0;


export function saveHistory(rl) {
    if (historyDb) {
        try {
            const insert = historyDb.prepare('INSERT INTO history (entry) VALUES(?)');
            const insertMany = historyDb.transaction(entries => {
                for (const str of entries) {
                    insert.run(str);
                }
            });

            insertMany(rl.history.slice(historyLoadIndex));
        } catch (e) {
            stderrWriter.write(encoder.encode(`Failed to save history: ${e}\n`));
        }
    }
}

export async function loadHistory(rl) {
    const TJS_HOME = tjs.env.TJS_HOME ?? path.join(tjs.homeDir, '.tjs');
    const historyDbPath = path.join(TJS_HOME, 'history.db');

    try {
        await tjs.makeDir(path.dirname(historyDbPath), { recursive: true });
    } catch (_) {
        // Ignore.
    }

    try {
        historyDb = new Database(historyDbPath);
    } catch (_) {
        // Ignore.
        return;
    }

    try {
        historyDb.prepare('CREATE TABLE IF NOT EXISTS history (entry TEXT NOT NULL)').run();
    } catch (_) {
        historyDb.close();
        historyDb = null;

        return;
    }

    const data = historyDb.prepare('SELECT entry from history').all();

    rl.history = data.map(row => row.entry);
    historyLoadIndex = data.length;
}

export function clearHistory(rl) {
    try {
        historyDb.exec('DELETE FROM history');
        historyDb.exec('VACUUM');
    } catch (_) {
        // Ignore.
    }

    rl.history = [];
    historyLoadIndex = 0;
}
