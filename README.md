# Create In Chosen Folder

An Obsidian plugin. When you click a link to a note that doesn't exist yet (for example `[[Bubba]]`), it asks you which folder to create the note in. Without it, Obsidian uses its default location.

- Type to filter your existing folders. Press Enter to create the note there.
- Type a path that doesn't exist yet, such as `People/Friends`, and pick **➕ Create folder** to make the folder and the note at the same time.
- Press Esc to cancel. Nothing gets created.
- Links that point to existing notes open as usual.
- Headings in links still work: `[[Bubba#Quotes]]` creates `Bubba.md` and opens it at that heading.

## Settings

- **Number of recent folders**: how many "recent" folders appear at the top of the picker (0–20, default 5). Set it to 0 to turn the recent section off. A folder counts as recent based on when notes directly inside it were created.

## Install

```sh
npm install
npm run build
mkdir -p <vault>/.obsidian/plugins/create-in-chosen-folder
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/create-in-chosen-folder/
```

Then turn it on in **Settings → Community plugins**.

## Privacy

This plugin works entirely offline. It makes no network requests, collects no data, and only reads and writes files inside your vault.
