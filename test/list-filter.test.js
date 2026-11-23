import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListFilterElement } from '../list-filter.js';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const tick = () => new Promise((resolve) => queueMicrotask(resolve));

async function mount(
	list = 'ul',
	child = 'li',
	attributes = 'search categories',
) {
	document.body.innerHTML = `
		<${list} id="items">
			<${child} data-category="drink">Fizzy <strong>Water</strong>
				<ul><li>Nested lemonade</li></ul>
			</${child}>
			<${child} data-category="food">Lemon cake</${child}>
			<${child} data-category="drink">LEMON tea</${child}>
			<${child} hidden data-category="private">Authored hidden item</${child}>
		</${list}>
		<list-filter for="items" ${attributes}></list-filter>`;
	await tick();
	return document.querySelector('list-filter');
}

function search(element, value) {
	const input = element.querySelector('input');
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('list-filter', () => {
	it('refreshes category option order after list reordering while preserving the selection', async () => {
		const element = await mount();
		const select = element.querySelector('select');
		expect([...select.options].map((option) => option.value)).toEqual([
			'',
			'drink',
			'food',
		]);
		select.value = 'drink';
		select.dispatchEvent(new Event('change'));
		const list = document.getElementById('items');
		list.prepend(list.querySelector('[data-category="food"]'));

		expect(element.refresh()).toBe(true);
		expect([...select.options].map((option) => option.value)).toEqual([
			'',
			'food',
			'drink',
		]);
		expect(select.value).toBe('drink');
		expect(element.querySelector('output').textContent).toBe('2 items');
	});

	it('completes refresh when its change listener removes the rebuilt component', async () => {
		const element = await mount();
		search(element, 'cake');
		element.querySelector('input').focus();
		element.setAttribute('search-label', 'Words');
		element.addEventListener('list-filter:change', () => element.remove(), {
			once: true,
		});
		expect(() => element.refresh()).not.toThrow();
		expect(element.isConnected).toBe(false);
		expect(document.querySelector('#items > li').hidden).toBe(false);
		await tick();
		expect(
			element.querySelector('[data-list-filter-generated]'),
		).toBeNull();
	});

	it('tracks repeated external hide and unhide cycles without excluding visible items', async () => {
		const element = await mount();
		const item = document.querySelector('#items > li');
		for (let cycle = 0; cycle < 2; cycle++) {
			item.hidden = true;
			element.reset();
			expect(element.querySelector('output').textContent).toBe('2 items');
			item.hidden = false;
			element.reset();
			expect(element.querySelector('output').textContent).toBe('3 items');
			search(element, 'cake');
			expect(item.hidden).toBe(true);
			element.reset();
			expect(item.hidden).toBe(false);
		}
	});

	it.each([
		['ul', 'li'],
		['ol', 'li'],
		['dl', 'div'],
	])('filters only eligible direct children of %s', async (list, child) => {
		const element = await mount(list, child);
		expect(element).toBeInstanceOf(ListFilterElement);
		expect(element.shadowRoot).toBeNull();
		expect(element.querySelector('legend').textContent).toBe(
			'Filter this list',
		);
		expect(element.querySelector('output').textContent).toBe('3 items');
		search(element, 'lemon');
		const items = [...document.getElementById('items').children];
		expect(items.map((item) => item.hidden)).toEqual([
			false,
			false,
			false,
			true,
		]);
		search(element, 'LEMON tea');
		expect(items.map((item) => item.hidden)).toEqual([
			true,
			true,
			false,
			true,
		]);
		expect(items[0].querySelector('li').hidden).toBe(false);
		expect(element.querySelector('output').textContent).toBe('1 item');
		search(element, '.*');
		expect(element.querySelector('output').textContent).toBe('0 items');
	});

	it('combines filters, deduplicates raw categories, and resets only its own controls', async () => {
		const element = await mount();
		const select = element.querySelector('select');
		expect([...select.options].map((option) => option.value)).toEqual([
			'',
			'drink',
			'food',
		]);
		search(element, 'lemon');
		select.value = 'drink';
		select.dispatchEvent(new Event('change'));
		expect(element.querySelector('output').textContent).toBe('2 items');
		select.value = '';
		select.dispatchEvent(new Event('change'));
		expect(element.querySelector('output').textContent).toBe('3 items');
		element.querySelector('button').click();
		expect(element.querySelector('input').value).toBe('');
		expect(element.querySelector('output').textContent).toBe('3 items');
		expect(document.querySelector('[data-category="private"]').hidden).toBe(
			true,
		);
	});

	it('maps category labels as plain text and localizes plural counts', async () => {
		const element = await mount(
			'ul',
			'li',
			`categories lang="pl"
			categories-map='{"drink":"<b>Napoje</b>"}'
			output-label="{count} rzeczy" output-label-few="{count} elementy"`,
		);
		expect(element.querySelector('input')).toBeNull();
		expect(element.querySelector('option[value="drink"]').textContent).toBe(
			'<b>Napoje</b>',
		);
		expect(element.querySelector('option b')).toBeNull();
		expect(element.querySelector('output').textContent).toBe('3 elementy');
	});

	it('wires a template with scoped refs without modifying its source', async () => {
		document.body.innerHTML = `<ul id="items"><li>Apple</li><li>Pear</li></ul>
			<list-filter for="items" search>
				<template><fieldset><legend>Find fruit</legend>
					<label>Fruit <input type="search" data-list-filter-ref="search" value="Pear"></label>
					<button type="button" data-list-filter-ref="reset">Clear</button>
					<output data-list-filter-ref="output"></output>
				</fieldset></template>
			</list-filter>`;
		await tick();
		const element = document.querySelector('list-filter');
		expect(element.querySelector('output').textContent).toBe('1 item');
		expect(document.querySelector('#items li').hidden).toBe(true);
		element.reset();
		expect(element.querySelector('input').value).toBe('');
		expect(
			element.querySelector('template').content.querySelector('input')
				.value,
		).toBe('Pear');
	});

	it('emits observable errors and leaves the fallback list usable', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const element = await mount();
		search(element, 'cake');
		const error = vi.fn();
		element.addEventListener('list-filter:error', error);
		element.setAttribute('categories-map', '[]');
		await tick();
		expect(log).toHaveBeenCalled();
		expect(error.mock.calls[0][0].detail.code).toBe(
			'invalid-categories-map',
		);
		expect(element.querySelector('fieldset')).toBeNull();
		expect(document.querySelector('#items li').hidden).toBe(false);
		expect(document.querySelector('[data-category="private"]').hidden).toBe(
			true,
		);
		element.removeAttribute('categories-map');
		await tick();
		expect(element.querySelector('fieldset')).not.toBeNull();
	});

	it('rejects invalid templates, unsupported list references, and fuzzy modes', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const element = await mount();
		for (const [name, value, code] of [
			['for', 'missing', 'invalid-list'],
			['search', 'fuzzy', 'invalid-search'],
		]) {
			const listener = vi.fn();
			element.addEventListener('list-filter:error', listener, {
				once: true,
			});
			const previous = element.getAttribute(name);
			element.setAttribute(name, value);
			await tick();
			expect(listener.mock.calls[0][0].detail.code).toBe(code);
			element.setAttribute(name, previous);
			await tick();
		}
		const template = document.createElement('template');
		template.innerHTML =
			'<input type="search" data-list-filter-ref="search">';
		element.append(template);
		expect(element.refresh()).toBe(false);
		expect(element.querySelector('fieldset')).toBeNull();
	});

	it('refreshes cached text and options while preserving active filters and control focus', async () => {
		const element = await mount();
		search(element, 'new');
		const input = element.querySelector('input');
		input.focus();
		const item = document.createElement('li');
		item.dataset.category = 'new';
		item.textContent = 'New arrival';
		document.getElementById('items').append(item);
		expect(element.refresh()).toBe(true);
		expect(element.querySelector('input')).toBe(input);
		expect(document.activeElement).toBe(input);
		expect(element.querySelector('output').textContent).toBe('1 item');
		expect(element.querySelector('option[value="new"]')).not.toBeNull();
	});

	it('restores owned visibility on disconnect and reenables filtering on reconnect', async () => {
		const element = await mount();
		search(element, 'cake');
		const first = document.querySelector('#items li');
		element.remove();
		expect(first.hidden).toBe(false);
		expect(document.querySelector('[data-category="private"]').hidden).toBe(
			true,
		);
		document.body.append(element);
		await tick();
		expect(element.querySelectorAll('fieldset')).toHaveLength(1);
		search(element, 'cake');
		expect(first.hidden).toBe(true);
	});

	it('rejects another owner without disturbing the original filter', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const element = await mount();
		search(element, 'cake');
		const other = document.createElement('list-filter');
		other.htmlFor = 'items';
		other.search = true;
		document.body.append(other);
		await tick();
		expect(other.querySelector('fieldset')).toBeNull();
		expect(element.querySelector('output').textContent).toBe('1 item');
		expect(document.querySelector('#items li').hidden).toBe(true);
	});

	it('emits fresh update details and delays count text during typing', async () => {
		const element = await mount('ul', 'li', 'search');
		vi.useFakeTimers();
		const listener = vi.fn();
		element.addEventListener('list-filter:change', listener);
		search(element, 'tea');
		expect(listener.mock.calls[0][0].detail).toEqual({
			reason: 'search',
			search: 'tea',
			category: '',
			shown: 1,
			total: 3,
		});
		expect(element.querySelector('output').textContent).toBe('1 item');
		expect(
			element.querySelector('[data-list-filter-ref="status"]')
				.textContent,
		).toBe('');
		await vi.advanceTimersByTimeAsync(300);
		expect(
			element.querySelector('[data-list-filter-ref="status"]')
				.textContent,
		).toBe('1 item');
		expect(element.querySelector('output').getAttribute('aria-live')).toBe(
			'off',
		);
	});

	it('preserves externally changed visibility and restores removed filtered items on refresh', async () => {
		const element = await mount();
		search(element, 'tea');
		const first = document.querySelector('#items li');
		first.remove();
		element.refresh();
		expect(first.hidden).toBe(false);
		const tea = document.querySelector('#items [data-category="drink"]');
		tea.setAttribute('hidden', 'until-found');
		element.reset();
		element.remove();
		expect(tea.getAttribute('hidden')).toBe('until-found');
	});

	it('updates generated labels without losing search text or focus', async () => {
		const element = await mount();
		search(element, 'cake');
		element.querySelector('input').focus();
		element.setAttribute('title', 'Find food');
		element.setAttribute('search-label', 'Words');
		element.setAttribute('search-placeholder', 'Try cake');
		element.setAttribute('reset-label', 'Clear');
		await tick();
		expect(element.querySelector('legend').textContent).toBe('Find food');
		expect(element.querySelector('input').value).toBe('cake');
		expect(element.querySelector('input').placeholder).toBe('Try cake');
		expect(element.querySelector('label').textContent).toBe('Words');
		expect(element.querySelector('button').textContent).toBe('Clear');
		expect(document.activeElement).toBe(element.querySelector('input'));
		expect(element.querySelector('output').textContent).toBe('1 item');
	});

	it('does not repeat visibility mutations for unchanged filter results', async () => {
		const element = await mount();
		const observer = new MutationObserver(() => {});
		observer.observe(document.getElementById('items'), {
			subtree: true,
			attributes: true,
			attributeFilter: ['hidden'],
		});
		try {
			search(element, 'cake');
			observer.takeRecords();
			search(element, 'CAKE');
			expect(observer.takeRecords()).toHaveLength(0);
		} finally {
			observer.disconnect();
		}
	});

	it('returns focus to the original list when invalid configuration removes focused controls', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const element = await mount();
		element.querySelector('input').focus();
		element.htmlFor = 'missing';
		await tick();
		const list = document.getElementById('items');
		expect(document.activeElement).toBe(list);
		expect(list.getAttribute('tabindex')).toBe('-1');
		const nextControl = document.createElement('button');
		document.body.append(nextControl);
		nextControl.focus();
		expect(list.hasAttribute('tabindex')).toBe(false);
		expect(list.querySelector('li').hidden).toBe(false);
	});

	it('bundles the declared API and registration types in the publishable package', async () => {
		const manifest = JSON.parse(
			await readFile('custom-elements.json', 'utf8'),
		);
		const component = manifest.modules.find(
			({ path }) => path === 'list-filter.js',
		).declarations[0];
		expect(component.attributes.map(({ name }) => name).sort()).toEqual(
			[...ListFilterElement.observedAttributes].sort(),
		);
		const [pack] = JSON.parse(
			execFileSync('npm', ['pack', '--dry-run', '--json'], {
				encoding: 'utf8',
			}),
		);
		expect(pack.files.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				'list-filter.js',
				'list-filter.d.ts',
				'index.js',
				'define.js',
				'define.d.ts',
				'custom-elements.json',
			]),
		);
		expect(
			pack.files.some(
				({ path }) =>
					path.startsWith('test/') || path.startsWith('demo/'),
			),
		).toBe(false);
		const { exports: exportsMap } = JSON.parse(
			await readFile('package.json', 'utf8'),
		);
		for (const entry of Object.values(exportsMap)) {
			for (const path of typeof entry === 'string'
				? [entry]
				: Object.values(entry)) {
				expect(await readFile(path, 'utf8')).not.toBe('');
			}
		}
	});
});
