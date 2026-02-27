/**
 * Post-processes typedoc-generated markdown files to replace colons
 * in filenames with dashes, and updates all internal references.
 * Sidebar labels and page titles preserve the original colon syntax (e.g. "tjs:assert").
 */
import { readdir, rename, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_DIR = join(import.meta.dirname, '..', 'docs', 'api');

async function main() {
  const files = await readdir(API_DIR);

  // Build rename map: old name -> new name
  const renameMap = new Map();
  for (const file of files) {
    if (file.includes(':')) {
      const newName = file.replaceAll(':', '-');
      renameMap.set(file, newName);
    }
  }

  if (renameMap.size === 0) {
    console.log('No files with colons found, nothing to fix.');
    return;
  }

  // Rename all files
  for (const [oldName, newName] of renameMap) {
    await rename(join(API_DIR, oldName), join(API_DIR, newName));
  }
  console.log(`Renamed ${renameMap.size} files.`);

  // Update references in all markdown files
  const updatedFiles = await readdir(API_DIR);
  const mdFiles = updatedFiles.filter(f => f.endsWith('.md'));

  for (const file of mdFiles) {
    const filePath = join(API_DIR, file);
    let content = await readFile(filePath, 'utf-8');
    let changed = false;

    // Split content into code blocks and non-code blocks so we only
    // perform replacements outside of fenced code blocks.
    const parts = content.split(/(```[\s\S]*?```)/g);

    for (let i = 0; i < parts.length; i++) {
      // Odd indices are fenced code blocks — skip them.
      if (i % 2 === 1) continue;

      let part = parts[i];
      for (const [oldName, newName] of renameMap) {
        const oldRef = oldName.replace('.md', '');
        const newRef = newName.replace('.md', '');

        // Replace markdown link targets: (oldName) -> (newName)
        if (part.includes(oldName)) {
          part = part.replaceAll(oldName, newName);
          changed = true;
        }
        // Replace doc IDs without extension
        if (part.includes(oldRef)) {
          part = part.replaceAll(oldRef, newRef);
          changed = true;
        }
      }
      parts[i] = part;
    }

    if (changed) {
      content = parts.join('');
      // Restore colon syntax in headings: "# tjs-assert" -> "# tjs:assert"
      content = content.replaceAll(/^(#{1,6} )tjs-/gm, '$1tjs:');
      await writeFile(filePath, content);
    }
  }

  // Fix the sidebar file: replace colons in id values but preserve labels
  const sidebarPath = join(API_DIR, 'typedoc-sidebar.cjs');
  let sidebarContent = await readFile(sidebarPath, 'utf-8');

  // Replace id values: id:"api/tjs:foo..." -> id:"api/tjs-foo..."
  sidebarContent = sidebarContent.replaceAll(/id:"api\/tjs:([^"]+)"/g, 'id:"api/tjs-$1"');

  await writeFile(sidebarPath, sidebarContent);
  console.log('Updated sidebar references (preserved labels).');

  console.log('Done fixing typedoc filenames.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
