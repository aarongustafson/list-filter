# GitHub social preview

This composition shows the actual local `<list-filter>` component twice:
all four reading resources on the left and the two CSS resources on the right.
The capture selects CSS through the generated native dropdown. It uses no
remote assets, mocked controls, or production changes.

## Regenerate

Install the component's declared development dependencies and Playwright
Chromium. The machine must have **Arial** and **Arial Bold** installed locally;
the capture fails if either is unavailable. These system fonts aren't copied
or redistributed here.

From the workspace root, inspect previews before starting one:

```sh
npm run servers:status -- list-filter
npm run servers:start -- list-filter
```

Use the URL returned by the manager. From the `list-filter` repository root:

```sh
node share-card/capture.mjs http://127.0.0.1:PORT
```

Replace `PORT` with the managed preview's port. This command captures, resizes,
and validates all three exports. It prints the Chromium version and byte counts.
The initial export used Chromium **158.0.8127.18** with this exact command:

```sh
node share-card/capture.mjs http://127.0.0.1:4318
```

The composition expects the component repository to be the server root.
After capture, stop the preview from the workspace root if you started it:

```sh
npm run servers:stop -- list-filter
```

The capture uses a fresh Chromium context, a 1280 × 640 viewport, 2× device
scale, English labels, a light color scheme, UTC, and reduced motion.
It waits for fonts and actual counts, selects CSS, asserts matching visible
items, clears capture focus, and moves the pointer to the margin.
Animations, transitions, and caret blinking are disabled in capture-only CSS.

Exports:

- `hero@2x.png`: opaque 2560 × 1280 master.
- `hero.png`: opaque 1280 × 640 PNG, strictly below 1,000,000 bytes.
- `preview.png`: 640 × 320, downsampled from the final export.

The package's explicit published-file list excludes this directory.
Inspect the final and half-size preview after regenerating; automated assertions
do not establish accessibility conformance. No GitHub upload is automated.

**Alt text:** Two reading lists with category filters: All shows four resources;
CSS shows only “CSS layout essentials” and “CSS color reference,” with counts
of four and two resources.
