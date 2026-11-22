# list-filter Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/list-filter.svg)](https://www.npmjs.com/package/@aarongustafson/list-filter)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/list-filter/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/list-filter/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/list-filter?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/list-filter)
[![License](https://img.shields.io/npm/l/@aarongustafson/list-filter)](https://github.com/aarongustafson/list-filter/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/list-filter)](https://github.com/aarongustafson/list-filter/blob/main/list-filter.d.ts)

Progressively filter native lists with light-DOM search and category controls.

## Demo

[Live Demo](https://aarongustafson.github.io/list-filter/demo/) ([Source](./demo/index.html))

Additional demos:

- [ESM CDN Demo](https://aarongustafson.github.io/list-filter/demo/esm.html) ([Source](./demo/esm.html))
- [Unpkg CDN Demo](https://aarongustafson.github.io/list-filter/demo/unpkg.html) ([Source](./demo/unpkg.html))

## Installation

```bash
npm install @aarongustafson/list-filter
```

## Usage

### Option 1: Auto-define the custom element (easiest)

Import the registration module to define the `<list-filter>` custom element:

```javascript
import '@aarongustafson/list-filter/define.js';
```

Or use the define-only script in HTML:

```html
<script
	src="./node_modules/@aarongustafson/list-filter/define.js"
	type="module"
></script>
```

### Option 2: Import the class and define manually

Import the class and define the custom element with your preferred tag name:

The package root and the component module are class-only imports; neither
registers an element automatically.

```javascript
import { ListFilterElement } from '@aarongustafson/list-filter/list-filter.js';

customElements.define('my-custom-name', ListFilterElement);
```

### Basic Example

```html
<list-filter>
	<!-- Your content here -->
</list-filter>
```

## Attributes

| Attribute           | Type     | Default | Description                  |
| ------------------- | -------- | ------- | ---------------------------- |
| `example-attribute` | `string` | absent  | Description of the attribute |

## Behavior and styling

The component preserves authored light-DOM children. Native content remains
available before registration and if JavaScript fails. Rendering and reconnection
don’t replace children or reset entered values.

The `exampleAttribute` property reflects `example-attribute` and returns `null`
when the attribute is absent. Assigning `null` or `undefined` removes the
attribute. Properties assigned before definition are upgraded on connection.

`render()` initializes enhancement without replacing authored content. The starter
doesn’t add roles, tab stops, events, or CSS custom properties. It schedules no
background work and installs no listeners that need disconnection cleanup.

Document styles apply directly. If you give the element a display style, preserve
the native `hidden` behavior:

```css
list-filter {
	display: block;
}

list-filter[hidden] {
	display: none;
}
```

## Browser Support

This component uses modern web standards:

- Custom Elements v1
- ES Modules

For older browsers, you may need polyfills.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Install browser engines and check demo colors, focus, and layout
npx playwright install chromium firefox webkit
npm run test:browser

# Lint code
npm run lint

# Format code
npm run format

# View demo
open demo/index.html
```

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
