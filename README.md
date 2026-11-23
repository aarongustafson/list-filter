# list-filter Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/list-filter.svg)](https://www.npmjs.com/package/@aarongustafson/list-filter)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/list-filter/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/list-filter/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/list-filter?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/list-filter)
[![License](https://img.shields.io/npm/l/@aarongustafson/list-filter)](https://github.com/aarongustafson/list-filter/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/list-filter)](https://github.com/aarongustafson/list-filter/blob/main/list-filter.d.ts)

`<list-filter>` adds a search field, a category dropdown, or both to an authored list. It filters
only direct `ol > li`, `ul > li`, or `dl > div` children, using `[hidden]` without
removing or reordering content. Controls and list content stay in light DOM.
Without JavaScript, the original list remains usable.

This is an initial development version, not an npm release. CDN examples will
not load the component until the package is published. No runtime dependencies
are required.

## Installation and registration

For local development, import the checked-out registration module:

```html
<script type="module" src="./list-filter/define.js"></script>
<list-filter for="drinks" search categories></list-filter>
<ul id="drinks">
  <li data-category="cold">Sparkling water</li>
  <li data-category="hot">Lemon tea</li>
  <li data-category="cold">Lemonade</li>
</ul>
```

After publication, install `@aarongustafson/list-filter` and import
`@aarongustafson/list-filter/define.js`. That module registers the element
automatically and exports the guarded `defineListFilter()` helper.
Its TypeScript declaration also loads the component's element and event typings;
you don't need a separate class import to use them.

The package root and `list-filter.js` export only the class. Neither registers
the element:

```js
import { ListFilterElement } from './list-filter.js';
customElements.define('list-filter', ListFilterElement);
```

## Filtering behavior

- `for` references one native list by ID in the same document or tree.
  Nested list items are never independently hidden; their text contributes to
  their containing direct item's search text.
- Search uses `textContent.toLowerCase()` and a literal substring match.
  It includes hidden descendant text, preserves whitespace, and does not
  interpret regular expressions, trim input, fold accents, or correct typos.
  `search="fuzzy"` and other nonempty modes report an error rather than changing
  matching behavior.
- Search and category filters combine with AND. An empty search matches all
  eligible items; the selectable first category option clears only category.
- Categories are exact, case-sensitive `data-category` values. Duplicate values
  appear once, in first-occurrence order. Missing and empty values have no
  option but remain visible when category is cleared. Unmapped values use their
  raw text. Labels from `categories-map` are inserted as text, never HTML.
- Items already carrying `[hidden]`, including `hidden="until-found"`, are
  excluded from counts and category discovery. Reset does not reveal them.
- Only one filter can own a list at a time. Unsupported direct children are
  left untouched. Individual `dt` and `dd` children are not filter items; wrap
  each definition group in a direct `div`.

## Generated markup and configuration

By default, the component generates a fieldset, legend, optional labeled search
and category fields, a reset button, and an output. Controls wrap in an inline
flex row, with labels above fields and the button aligned at block-end.
The reset button has `type="button"` and never resets an enclosing form.

| Attribute                 | Default              | Purpose                                    |
| ------------------------- | -------------------- | ------------------------------------------ |
| `for`                     | Required             | Associated list ID                         |
| `search`                  | Absent               | Empty attribute enables search             |
| `categories`              | Absent               | Presence enables categories                |
| `title`                   | `Filter this list`   | Generated legend                           |
| `search-label`            | `By search term`     | Generated search label                     |
| `search-placeholder`      | Absent               | Optional search placeholder                |
| `categories-label`        | `By category`        | Generated select label                     |
| `categories-placeholder`  | `All`                | Selectable no-filter option label          |
| `categories-map`          | `{}`                 | JSON object of raw values to string labels |
| `reset-label`             | `Reset filters`      | Generated button label                     |
| `output-label`            | `{count} items`      | Base count template                        |
| `output-label-{category}` | Base template        | Plural-specific count template             |
| `announce`                | `polite`             | `polite` or `off` announcements            |
| `lang`                    | Inherited, then `en` | Language for plural selection              |

Labels configure generated controls. A template supplies its own legend,
control labels, search placeholder, and reset text; category option labels and
count messages still use the component attributes.

### Count labels and translation

The output initializes with the number currently shown and updates immediately.
`{count}` is replaced in `output-label` and any plural overrides. Without custom
labels, the singular English default is "1 item".

Plural selection follows `Intl.PluralRules` with the inherited language:
`zero`, `one`, `two`, `few`, `many`, or `other`. Language lookup crosses authored
shadow hosts, and the nearest `lang` wins. An empty `lang` uses the component’s
English fallback. Missing variants fall back to
`output-label`, then the built-in labels. Override all generated English
strings for a translated interface:

```html
<list-filter
  for="boissons"
  search
  categories
  lang="fr"
  title="Filtrer les boissons"
  search-label="Par terme"
  categories-label="Par catégorie"
  categories-placeholder="Toutes"
  categories-map='{"cold":"Froides","hot":"Chaudes"}'
  reset-label="Réinitialiser"
  output-label="{count} boissons"
  output-label-one="{count} boisson"
></list-filter>
```

Use `output-label-other` for an explicit `other` override. Invalid language tags
or category-map JSON report errors instead of silently choosing another API.

## Authored templates

Supply one direct-child `<template>` to replace generated controls. The component
clones its contents into light DOM and leaves the template source untouched.
Refs are scoped to that clone, so outside controls cannot be wired accidentally.

```html
<list-filter for="drinks" search categories>
  <template>
    <fieldset>
      <legend>Find a drink</legend>
      <label>
        Search drinks
        <input type="search" data-list-filter-ref="search" />
      </label>
      <label>
        Temperature
        <select data-list-filter-ref="categories"></select>
      </label>
      <button type="button" data-list-filter-ref="reset">Clear</button>
      <output data-list-filter-ref="output"></output>
    </fieldset>
  </template>
</list-filter>
```

Provide exactly one reset button and one output. Provide exactly one search
input when `search` is enabled, and exactly one select when `categories` is
enabled; omit their refs otherwise. Invalid or duplicate refs fail before
filtering begins. The component replaces select options and output text in the
clone. Initial template search values are applied on initialization.

Authors supply accessible labels, unique IDs where used, and useful reading and
keyboard order. Treat templates as trusted authored markup, not sanitized HTML:
do not construct them from untrusted strings. Native form submission behavior
for authored control names remains the author's responsibility.

## Properties, methods, and events

`htmlFor` reflects `for`; assigning `null` or `undefined` removes it.
`search` and `categories` are boolean presence properties. These properties
also work when assigned before definition. Other options use attributes.

- `refresh(): boolean` validates configuration, rescans current list text and
  categories, updates category options to the list's current first-occurrence
  order, and reapplies active filters. Call it after structural, text,
  `data-category`, template-content, or inherited-language changes. There is no
  MutationObserver. Existing controls and focus are preserved when configuration
  and template identity have not changed. Call while connected.
- `reset(): boolean` clears this component's filters. Call after initialization.
- Both methods return `false` on a reported error and `true` on success.
  If a template child's connection callback removes the filter during insertion,
  `refresh()` stops without throwing or emitting a change event and returns
  `true`. Disconnection restores the list and releases its owner.
  List records, category options, labels, and preserved filter values are ready
  before template children connect. If a child's connection callback calls
  `reset()` or `refresh()`, that update takes precedence; setup does not restore
  older values or emit an additional stale update.

`list-filter:change` bubbles and is composed. Each update emits fresh detail:

```js
document
  .querySelector('list-filter')
  .addEventListener(
    'list-filter:change',
    ({ detail: { reason, search, category, shown, total } }) => {
      console.log(reason, search, category, shown, total);
    },
  );
```

`reason` is `init`, `refresh`, `search`, `category`, or `reset`. Counts exclude
authored hidden items. Register initialization listeners before connecting or
registering the element.

`list-filter:error` also bubbles and is composed, with `{ code, message }`.
Codes cover invalid list references, list ownership, unsupported search modes,
announcement settings, JSON maps, language tags, templates, and calls made
before the component is ready. Errors log to `console.error`, remove enhancement
controls, and restore component-owned list visibility. No visible message is
inserted for a missing reference. Applications can use the event for recovery;
fix configuration and call `refresh()`.
Attribute changes schedule a retry automatically.

## Accessibility, styling, and lifecycle

Visible count text updates immediately. Its `<output>` uses `aria-live="off"` to
avoid duplicate announcements. A separate visually hidden `role="status"` region
announces changes politely after a 300ms typing pause, and immediately for
category changes and reset. Initialization is not announced. Use `announce="off"`
when an application supplies its own announcements. These semantics need
browser/screen-reader verification; automated tests do not establish conformance.

Native controls retain keyboard behavior and labels. Filtering does not normally
move focus. If an item containing focus is hidden, focus moves to the first
usable control in search, category, reset order. Disabled controls, including
those disabled by an enclosing fieldset, are skipped. If none can receive focus,
focus moves to the list. Configuration changes rebuild controls and restore
control focus where possible, using the same fallback for extra focusable template
content. If an update listener removes or replaces the enhancement, refresh
does not attempt to focus its discarded controls. A focus or blur listener that
removes or rebuilds controls also stops the old filtering update before it can
change list visibility or overwrite the new count. If the listener calls
`reset()` or `refresh()` without replacing controls, the newer update takes
precedence for visibility, counts, events, and announcements. Focus recovery also works
when the component and list share an authored shadow-root tree; the component
itself still uses light DOM. Supply visible empty-state guidance alongside the
list if the count alone is insufficient.
If invalid configuration removes a focused control, focus returns to the original
list when it is still connected, without changing its authored tab order. A list
without `tabindex` receives `tabindex="-1"` until focus leaves or the component
cleans up; existing tabindex values are preserved.

Style light-DOM descendants with `[data-list-filter-controls]` and
`[data-list-filter-ref="search"]`, `"categories"`, `"reset"`, or `"output"`.
`--list-filter-gap` sets the generated row gap, defaulting to `1rem`. Template
layouts receive no generated layout styles. Preserve `[hidden]` behavior in
list styling; do not override it with unconditional display rules.

Disconnection cancels announcements, removes generated clones/listeners, releases
ownership, and restores hidden attributes changed by the component. Reconnection
starts from template defaults. Externally changed hidden attributes are preserved
when their current value differs from the last component-written value. Identical
external writes cannot be distinguished: coordinate visibility through one owner.
Removed items regain component-owned visibility on the next refresh.

Filtering scans cached text once per item per update; DOM text is read only
during refresh. Category options are deduplicated. Very large lists should be
profiled in the application's browsers before adoption. Unchanged visibility
does not trigger another hidden-attribute write.

## Demos and development

- [Local examples](demo/index.html): search, category mapping, translated
  definitions, authored templates, and invalid-reference recovery.
- [esm.sh](demo/esm.html) and [unpkg](demo/unpkg.html): post-publication imports,
  with useful native lists if loading fails.

```sh
npm ci
npm run test:run
npm run test:types
npm run lint
npm run test:browser
```

Keep the existing `version` and `postversion` scripts and publishing workflows.
No release, version bump, or npm publication is part of this implementation.

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
