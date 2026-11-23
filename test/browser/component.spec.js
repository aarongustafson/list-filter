import { test, expect } from '@playwright/test';
import {
	serveDemo,
	expectPairLayout,
	expectNativeFocus,
} from './demo-fixture.js';

for (const scenario of [
	{ initialized: false, action: 'reset' },
	{ initialized: true, action: 'reset' },
	{ initialized: false, action: 'refresh' },
	{ initialized: true, action: 'refresh' },
]) {
	const { initialized, action } = scenario;
	test(`honors a template child's ${action} during ${initialized ? 'rebuild' : 'initialization'} without incomplete updates`, async ({
		page,
	}) => {
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await serveDemo(page, {
			transformHtml: () =>
				'<!doctype html><html lang="en"><head><title>Template lifecycle fixture</title><script type="module" src="/define.js"></script></head><body></body></html>',
		});
		await page.goto('http://code-demo.test/demo/index.html');
		const result = await page.evaluate(async ({ initialized, action }) => {
			await customElements.whenDefined('list-filter');
			let updateResult;
			let optionsAtConnection;
			customElements.define(
				'reset-filter',
				class extends HTMLElement {
					connectedCallback() {
						const filter = this.closest('list-filter');
						optionsAtConnection = [
							...filter.querySelector('select').options,
						].map((option) => option.value);
						if (action === 'reset') updateResult = filter.reset();
						else {
							filter.querySelector('input').value = 'Second';
							filter.querySelector('select').value = 'reference';
							updateResult = filter.refresh();
						}
					}
				},
			);
			const list = document.createElement('ul');
			list.id = 'reset-items';
			list.innerHTML =
				'<li data-category="guide">First</li><li data-category="reference">Second</li><li data-category="guide">Third</li><li hidden>Private</li>';
			const filter = document.createElement('list-filter');
			filter.setAttribute('for', list.id);
			filter.setAttribute('search', '');
			filter.setAttribute('categories', '');
			filter.lang = 'pl';
			filter.setAttribute('output-label-few', '{count} few');
			filter.setAttribute('output-label-other', '{count} other');
			document.body.append(list);
			if (initialized) {
				document.body.append(filter);
				await new Promise((resolve) => queueMicrotask(resolve));
				const input = filter.querySelector('input');
				input.value = 'First';
				input.dispatchEvent(new Event('input'));
				const select = filter.querySelector('select');
				select.value = 'guide';
				select.dispatchEvent(new Event('change'));
			}
			const template = document.createElement('template');
			template.innerHTML = `
				<label>Words <input type="search" data-list-filter-ref="search"></label>
				<label>Category <select data-list-filter-ref="categories"></select></label>
				<button type="button" data-list-filter-ref="reset">Reset</button>
				<output data-list-filter-ref="output"></output>
				<reset-filter></reset-filter>`;
			filter.append(template);
			const updates = [];
			filter.addEventListener('list-filter:change', ({ detail }) =>
				updates.push(detail),
			);
			if (initialized) filter.refresh();
			else document.body.append(filter);
			await new Promise((resolve) => queueMicrotask(resolve));
			return {
				updateResult,
				optionsAtConnection,
				updates,
				search: filter.querySelector('input').value,
				category: filter.querySelector('select').value,
				output: filter.querySelector('output').textContent,
				hidden: [...list.children].map((item) => item.hidden),
			};
		}, scenario);
		expect(errors).toEqual([]);
		expect(result).toEqual({
			updateResult: true,
			optionsAtConnection: ['', 'guide', 'reference'],
			updates: [
				{
					reason: action,
					search: action === 'reset' ? '' : 'Second',
					category: action === 'reset' ? '' : 'reference',
					shown: action === 'reset' ? 3 : 1,
					total: 3,
				},
			],
			search: action === 'reset' ? '' : 'Second',
			category: action === 'reset' ? '' : 'reference',
			output: action === 'reset' ? '3 few' : '1 item',
			hidden:
				action === 'reset'
					? [false, false, false, true]
					: [true, false, true, true],
		});
	});
}

for (const initialized of [false, true]) {
	test(`stops refresh when a template child disconnects the filter during ${initialized ? 'rebuild' : 'initialization'}`, async ({
		page,
	}) => {
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await serveDemo(page, {
			transformHtml: () =>
				'<!doctype html><html lang="en"><head><title>Template lifecycle fixture</title><script type="module" src="/define.js"></script></head><body></body></html>',
		});
		await page.goto('http://code-demo.test/demo/index.html');
		const result = await page.evaluate(async (initialized) => {
			await customElements.whenDefined('list-filter');
			customElements.define(
				'disconnect-filter',
				class extends HTMLElement {
					connectedCallback() {
						this.closest('list-filter').remove();
					}
				},
			);
			const list = document.createElement('ul');
			list.id = 'disconnect-items';
			list.innerHTML =
				'<li>First</li><li>Second</li><li hidden>Private</li>';
			const filter = document.createElement('list-filter');
			filter.setAttribute('for', list.id);
			filter.setAttribute('search', '');
			document.body.append(list, filter);
			if (initialized) {
				filter.refresh();
				const input = filter.querySelector('input');
				input.value = 'First';
				input.dispatchEvent(new Event('input'));
			}
			const template = document.createElement('template');
			template.innerHTML = `
				<label>Words <input type="search" data-list-filter-ref="search"></label>
				<button type="button" data-list-filter-ref="reset">Reset</button>
				<output data-list-filter-ref="output"></output>
				<disconnect-filter></disconnect-filter>`;
			filter.append(template);
			const updates = [];
			filter.addEventListener('list-filter:change', ({ detail }) =>
				updates.push(detail),
			);
			const refreshed = filter.refresh();
			const disconnected = !filter.isConnected;
			const generated = filter.querySelector(
				'[data-list-filter-generated]',
			);
			const hidden = [...list.children].map((item) => item.hidden);
			const replacement = document.createElement('list-filter');
			replacement.setAttribute('for', list.id);
			document.body.append(replacement);
			return {
				refreshed,
				disconnected,
				generated: Boolean(generated),
				hidden,
				updates,
				recovered: replacement.refresh(),
				output: replacement.querySelector('output')?.textContent,
			};
		}, initialized);
		expect(result).toEqual({
			refreshed: true,
			disconnected: true,
			generated: false,
			hidden: [false, false, true],
			updates: [],
			recovered: true,
			output: '2 items',
		});
		expect(errors).toEqual([]);
	});
}

for (const event of ['focus', 'blur']) {
	for (const action of ['reset', 'refresh']) {
		test(`preserves the newer result when a ${event} listener calls ${action} without replacing controls`, async ({
			page,
		}) => {
			await serveDemo(page);
			await page.goto('http://code-demo.test/demo/index.html');
			await page.clock.install();
			const result = await page
				.locator('list-filter[for="reading"]')
				.evaluate(
					(element, { event, action }) => {
						const link = document.querySelector('#reading a');
						link.focus();
						const input = element.querySelector('input');
						const updates = [];
						element.addEventListener(
							'list-filter:change',
							({ detail }) => {
								updates.push(detail);
							},
						);
						const target = event === 'focus' ? input : link;
						target.addEventListener(
							event,
							() => {
								if (action === 'reset') element.reset();
								else {
									input.value = 'CSS';
									element.refresh();
								}
							},
							{ once: true },
						);
						input.value = 'HTML forms';
						input.dispatchEvent(new Event('input'));
						return {
							sameInput: input === element.querySelector('input'),
							search: input.value,
							shown: [
								...document.querySelector('#reading').children,
							]
								.filter((item) => !item.hidden)
								.map((item) => item.textContent.trim()),
							output: element.querySelector('output').textContent,
							update: updates.at(-1),
						};
					},
					{ event, action },
				);
			expect(result).toEqual({
				sameInput: true,
				search: action === 'reset' ? '' : 'CSS',
				shown:
					action === 'reset'
						? [
								'CSS reference',
								'Progressive enhancement handbook',
								'HTML forms guide',
							]
						: ['CSS reference'],
				output: action === 'reset' ? '3 items' : '1 item',
				update: {
					reason: action,
					search: action === 'reset' ? '' : 'CSS',
					category: '',
					shown: action === 'reset' ? 3 : 1,
					total: 3,
				},
			});
			await page.clock.runFor(350);
			await expect(
				page.locator(
					'list-filter[for="reading"] [data-list-filter-ref="status"]',
				),
			).toHaveText(action === 'reset' ? '3 items' : '1 item');
		});
	}
}

for (const event of ['focus', 'blur']) {
	for (const action of ['remove', 'rebuild']) {
		test(`stops stale filtering when a ${event} listener causes ${action} during focus recovery`, async ({
			page,
		}) => {
			const errors = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await serveDemo(page);
			await page.goto('http://code-demo.test/demo/index.html');
			const result = await page
				.locator('list-filter[for="reading"]')
				.evaluate(
					(element, { event, action }) => {
						const link = document.querySelector('#reading a');
						link.focus();
						const input = element.querySelector('input');
						const target = event === 'focus' ? input : link;
						target.addEventListener(
							event,
							() => {
								if (action === 'remove') element.remove();
								else {
									element.setAttribute(
										'search-label',
										'New search',
									);
									element.querySelector('input').value = '';
									element.refresh();
								}
							},
							{ once: true },
						);
						input.value = 'HTML forms';
						input.dispatchEvent(new Event('input'));
						return {
							connected: element.isConnected,
							hidden: [
								...document.querySelector('#reading').children,
							].map((item) => item.hidden),
							output:
								element.querySelector('output')?.textContent ??
								null,
						};
					},
					{ event, action },
				);
			expect(result).toEqual({
				connected: action === 'rebuild',
				hidden: [false, false, false],
				output: action === 'rebuild' ? '3 items' : null,
			});
			expect(errors).toEqual([]);
		});
	}
}

test('inherits plural language through nested shadow hosts and honors local overrides', async ({
	page,
}) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	await page.evaluate(() => {
		const host = document.createElement('div');
		host.lang = 'pl';
		const outer = host.attachShadow({ mode: 'open' });
		const innerHost = document.createElement('div');
		outer.append(innerHost);
		const inner = innerHost.attachShadow({ mode: 'open' });
		inner.innerHTML = `<list-filter id="plural-filter" for="plural-items"
			output-label-few="{count} few" output-label-other="{count} other"></list-filter>
			<ul id="plural-items"><li>One</li><li>Two</li><li>Three</li></ul>`;
		document.body.append(host);
	});
	const filter = page.locator('#plural-filter');
	await expect(filter.locator('output')).toHaveText('3 few');
	await filter.evaluate((element) => {
		element.lang = 'en';
	});
	await expect(filter.locator('output')).toHaveText('3 other');
});

test('recovers focus from extra template content and tolerates removal during refresh', async ({
	page,
}) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	const filter = page.locator('list-filter[for="fruit"]');
	await filter.evaluate((element) => {
		const help = document.createElement('a');
		help.href = '#help';
		help.textContent = 'Help with fruit';
		element.querySelector('template').content.append(help);
		element.refresh();
	});
	await filter.getByRole('link', { name: 'Help with fruit' }).focus();
	await filter.evaluate((element) => {
		element.setAttribute('search-label', 'Words');
	});
	await expect(filter.getByRole('searchbox')).toBeFocused();
	expect(
		await filter.evaluate((element) => {
			element.addEventListener(
				'list-filter:change',
				() => element.remove(),
				{ once: true },
			);
			element.setAttribute('search-label', 'New words');
			return element.refresh();
		}),
	).toBe(true);
	await expect(page.locator('#fruit')).toBeVisible();
	await expect(filter).toHaveCount(0);
});

test('recovers list and control focus within a shadow-root tree', async ({
	page,
}) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	await page.evaluate(() => {
		const host = document.createElement('div');
		host.id = 'shadow-fixture';
		const root = host.attachShadow({ mode: 'open' });
		root.innerHTML = `<list-filter for="shadow-items" search></list-filter>
			<ul id="shadow-items"><li><a href="#detail">Apple</a></li><li>Pear</li></ul>`;
		document.body.append(host);
	});
	const fixture = page.locator('#shadow-fixture');
	const filter = fixture.locator('list-filter');
	await fixture.getByRole('link', { name: 'Apple' }).focus();
	await filter.evaluate((element) => {
		const input = element.querySelector('input');
		input.value = 'pear';
		input.dispatchEvent(new Event('input'));
	});
	await expect(filter.getByRole('searchbox')).toBeFocused();
	await filter.evaluate((element) => {
		element.setAttribute('search-label', 'Fruit');
	});
	await expect(
		filter.getByRole('searchbox', { name: 'Fruit' }),
	).toBeFocused();
	await filter.evaluate((element) => {
		element.htmlFor = 'missing';
	});
	await expect(fixture.locator('#shadow-items')).toBeFocused();
});

for (const disabling of ['input', 'fieldset', 'all']) {
	test(`skips ${disabling}-disabled template controls during focus recovery`, async ({
		page,
	}) => {
		await serveDemo(page);
		await page.goto('http://code-demo.test/demo/index.html');
		await page.evaluate((mode) => {
			const fixture = document.createElement('div');
			fixture.id = 'disabled-fixture';
			fixture.innerHTML = `<list-filter for="disabled-items" search categories>
				<template>
					<fieldset ${mode !== 'input' ? 'disabled' : ''}>
						<label>Fruit <input type="search" data-list-filter-ref="search" ${mode === 'input' ? 'disabled' : ''}></label>
					</fieldset>
					<label>Category <select data-list-filter-ref="categories" ${mode === 'all' ? 'disabled' : ''}></select></label>
					<button type="button" data-list-filter-ref="reset" ${mode === 'all' ? 'disabled' : ''}>Clear</button>
					<output data-list-filter-ref="output"></output>
				</template>
			</list-filter>
			<ul id="disabled-items"><li data-category="fruit"><a href="#detail">Apple</a></li><li data-category="fruit">Pear</li></ul>`;
			document.body.append(fixture);
		}, disabling);
		const fixture = page.locator('#disabled-fixture');
		const filter = fixture.locator('list-filter');
		await expect(filter.getByRole('searchbox')).toBeVisible();
		await fixture.getByRole('link', { name: 'Apple' }).focus();
		await filter.evaluate((element) => {
			const input = element.querySelector('input');
			input.value = 'pear';
			input.dispatchEvent(new Event('input'));
		});
		const target =
			disabling === 'all'
				? fixture.locator('#disabled-items')
				: filter.getByRole('combobox');
		await expect(target).toBeFocused();
		await expect(
			fixture.getByRole('link', { name: 'Apple', includeHidden: true }),
		).toBeHidden();
		if (disabling === 'all') {
			await expect(target).toHaveAttribute('tabindex', '-1');
			await page
				.locator('list-filter[for="reading"]')
				.getByRole('searchbox')
				.focus();
			await expect(target).not.toHaveAttribute('tabindex');
		} else {
			await filter.evaluate((element) => {
				element
					.querySelector('template')
					.content.querySelector('select').disabled = true;
				element.refresh();
			});
			await expect(
				filter.getByRole('button', { name: 'Clear' }),
			).toBeFocused();
		}
	});
}

test('supports native keyboard filtering, reset, and template controls', async ({
	page,
}) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	const drinks = page.locator('list-filter[for="drinks"]');
	const search = drinks.getByRole('searchbox', { name: 'By search term' });
	await search.focus();
	await page.keyboard.type('LEMON');
	await expect(page.locator('#drinks > li:not([hidden])')).toHaveCount(2);
	await page.keyboard.press('Tab');
	await expect(
		drinks.getByRole('combobox', { name: 'By category' }),
	).toBeFocused();
	await drinks.getByRole('combobox').selectOption('hot');
	await expect(page.locator('#drinks > li:not([hidden])')).toHaveCount(1);
	await expect(drinks.locator('output')).toHaveText('1 item');
	// Safari's default keyboard navigation reaches buttons with Option+Tab.
	await page.keyboard.press(
		test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab',
	);
	await expect(
		drinks.getByRole('button', { name: 'Reset filters' }),
	).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(search).toHaveValue('');
	await expect(page.locator('#drinks > li:not([hidden])')).toHaveCount(3);
	await search.fill('not in this list');
	await expect(drinks.locator('output')).toHaveText('0 items');
	await expect(drinks.locator('[role="status"]')).toHaveText('0 items');

	const fruit = page.locator('list-filter[for="fruit"]');
	await fruit.getByRole('searchbox', { name: 'Fruit name' }).fill('PEAR');
	await expect(page.locator('#fruit > li:not([hidden])')).toHaveText('Pear');
	await fruit.getByRole('button', { name: 'Clear' }).click();
	await expect(page.locator('#fruit > li:not([hidden])')).toHaveCount(2);
});

test('introduces category-only controls with raw keys before mapped labels and combined filters', async ({
	page,
}) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	const raw = page.locator('list-filter[for="raw-drinks"]');
	const mapped = page.locator('list-filter[for="mapped-drinks"]');
	await expect(raw.getByRole('combobox')).toBeVisible();
	await expect(mapped.getByRole('combobox')).toBeVisible();
	for (const filter of [raw, mapped]) {
		await expect(filter.getByRole('searchbox')).toHaveCount(0);
	}
	expect(await raw.locator('option').allTextContents()).toEqual([
		'All',
		'cold',
		'hot',
	]);
	expect(await mapped.locator('option').allTextContents()).toEqual([
		'All',
		'Cold drinks',
		'Hot drinks',
	]);
	const order = await page
		.locator('list-filter')
		.evaluateAll((filters) =>
			filters.map((filter) => filter.getAttribute('for')),
		);
	expect(order.indexOf('raw-drinks')).toBeLessThan(
		order.indexOf('mapped-drinks'),
	);
	expect(order.indexOf('mapped-drinks')).toBeLessThan(
		order.indexOf('drinks'),
	);
	await raw.getByRole('combobox').selectOption('cold');
	await expect(page.locator('#raw-drinks > li:not([hidden])')).toHaveCount(2);
	await mapped.getByRole('combobox').selectOption({ label: 'Hot drinks' });
	await expect(page.locator('#mapped-drinks > li:not([hidden])')).toHaveText(
		'Lemon tea',
	);
	await raw.getByRole('combobox').selectOption('');
	await expect(page.locator('#raw-drinks > li:not([hidden])')).toHaveCount(3);
});

test('upgrades without registration side effects, form resets, or lost focus', async ({
	page,
}) => {
	const markup = `<!doctype html><html lang="en"><title>Upgrade contract</title>
		<form><label>Name <input name="name"></label>
		<list-filter></list-filter></form>
		<ul id="items"><li><a href="#detail">Apple</a></li><li>Pear</li></ul></html>`;
	await serveDemo(page, { transformHtml: () => markup });
	await page.goto('http://code-demo.test/demo/index.html');
	const name = page.getByRole('textbox', { name: 'Name', exact: true });
	await name.fill('Preserved input');
	await page.locator('list-filter').evaluate((element) => {
		element.htmlFor = 'items';
		element.search = true;
	});
	expect(
		await page.evaluate(async () => {
			const { ListFilterElement } = await import(
				new URL('../index.js', location.href).href
			);
			return {
				exportedClass: typeof ListFilterElement,
				registered: !!customElements.get('list-filter'),
			};
		}),
	).toEqual({ exportedClass: 'function', registered: false });
	await page.evaluate(async () => {
		await import(new URL('../define.js', location.href).href);
		await customElements.whenDefined('list-filter');
	});
	await expect(name).toBeFocused();
	await expect(name).toHaveValue('Preserved input');
	const filter = page.locator('list-filter');
	const search = filter.getByRole('searchbox');
	await search.fill('pear');
	await filter.getByRole('button').click();
	await expect(name).toHaveValue('Preserved input');
	expect(
		await filter.evaluate((element) => ({
			hasShadow: element.shadowRoot !== null,
			shadowsProperty: Object.hasOwn(element, 'htmlFor'),
		})),
	).toEqual({ hasShadow: false, shadowsProperty: false });

	await page.getByRole('link', { name: 'Apple' }).focus();
	await filter.evaluate((element) => {
		element.querySelector('input').value = 'pear';
		element.querySelector('input').dispatchEvent(new Event('input'));
	});
	await expect(search).toBeFocused();
	await expect(
		page.getByRole('link', { name: 'Apple', includeHidden: true }),
	).toBeHidden();
	await filter.evaluate((element) => {
		element.remove();
		document.querySelector('form').append(element);
	});
	await expect(page.getByRole('link', { name: 'Apple' })).toBeVisible();
	await expect(name).toHaveValue('Preserved input');
	await filter.getByRole('searchbox').focus();
	await filter.evaluate((element) => {
		element.htmlFor = 'missing';
	});
	await expect(page.locator('#items')).toBeFocused();
	await expect(page.locator('#items')).toHaveAttribute('tabindex', '-1');
	await name.focus();
	await expect(page.locator('#items')).not.toHaveAttribute('tabindex');
});

test('keeps definitions grouped and omits filter UI for missing references', async ({
	page,
}) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	const french = page.locator('list-filter[for="glossary"]');
	await french
		.getByRole('combobox', { name: 'Par catégorie' })
		.selectOption('css');
	await expect(page.locator('#glossary > div:not([hidden])')).toHaveCount(1);
	await expect(page.locator('#glossary > div[hidden] dt')).toBeHidden();
	await expect(page.locator('#glossary > div[hidden] dd')).toBeHidden();
	await expect(french.locator('output')).toHaveText('1 terme');
	const recoveryExample = page.locator('.demo').filter({
		has: page.locator('#recovery'),
	});
	await expect(recoveryExample.getByRole('alert')).toHaveCount(0);
	await expect(recoveryExample.getByRole('status')).toHaveCount(0);
	await expect(page.locator('#recovery fieldset')).toHaveCount(0);
	await page
		.getByRole('button', { name: 'Correct the list reference' })
		.click();
	await expect(
		page.locator('#recovery').getByRole('searchbox'),
	).toBeVisible();
	await expect(page.locator('#recovery-list')).toBeVisible();
});

test('retains useful native lists without JavaScript', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await serveDemo(page);
		await page.goto('http://code-demo.test/demo/index.html');
		await expect(page.locator('#reading > li')).toHaveCount(3);
		await expect(
			page.getByRole('link', { name: 'CSS reference', exact: true }),
		).toBeVisible();
		await expect(page.locator('#drinks > li')).toHaveCount(3);
		await expect(page.locator('#glossary > div')).toHaveCount(2);
		await expect(page.locator('#fruit')).toBeVisible();
		await expect(page.getByRole('searchbox')).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test('keeps generated and authored controls usable at narrow widths and in forced colors', async ({
	page,
}) => {
	await page.emulateMedia({ forcedColors: 'active' });
	await page.setViewportSize({ width: 320, height: 800 });
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	for (const pair of await page.locator('.code-demo-pair').all()) {
		await expectPairLayout(pair, 320);
	}
	for (const control of await page
		.locator('list-filter input, list-filter select, list-filter button')
		.all()) {
		await expectNativeFocus(control);
	}
	expect(
		await page
			.locator('list-filter[for="drinks"]')
			.getByRole('group')
			.ariaSnapshot(),
	).toContain('Find a drink');
});

test('filters a realistic large list using cached text and publishes accurate counts', async ({
	page,
}) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	const result = await page
		.locator('list-filter[for="reading"]')
		.evaluate((element) => {
			const list = document.getElementById('reading');
			const fragment = document.createDocumentFragment();
			for (let index = 0; index < 2000; index++) {
				const item = document.createElement('li');
				item.textContent = `Resource ${index} ${index % 2 ? 'HTML' : 'CSS'}`;
				fragment.append(item);
			}
			list.replaceChildren(fragment);
			element.refresh();
			const start = performance.now();
			element.querySelector('input').value = 'CSS';
			element.querySelector('input').dispatchEvent(new Event('input'));
			return {
				elapsed: performance.now() - start,
				shown: list.querySelectorAll(':scope > li:not([hidden])')
					.length,
				count: element.querySelector('output').textContent,
			};
		});
	expect(result.shown).toBe(1000);
	expect(result.count).toBe('1000 items');
	test.info().annotations.push({
		type: 'filter-duration',
		description: `${result.elapsed.toFixed(2)}ms for 2,000 items`,
	});
});

for (const colorScheme of ['light', 'dark']) {
	test(`${colorScheme}: demo filter controls share typography and height at normal and enlarged text sizes`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme });
		await page.setViewportSize({ width: 1440, height: 900 });
		await serveDemo(page);
		await page.goto('http://code-demo.test/demo/index.html');
		await expect(
			page.locator('list-filter[for="drinks"] input'),
		).toBeVisible();
		for (const fontSize of [16, 24]) {
			await page.evaluate((size) => {
				document.documentElement.style.fontSize = `${size}px`;
			}, fontSize);
			const sizes = await page
				.locator(
					'list-filter input, list-filter select, list-filter button',
				)
				.evaluateAll((controls) =>
					controls.map((control) => {
						const css = getComputedStyle(control);
						return {
							tag: control.tagName,
							fontSize: parseFloat(css.fontSize),
							lineHeight: parseFloat(css.lineHeight),
							height: control.getBoundingClientRect().height,
						};
					}),
				);
			expect(sizes.length).toBeGreaterThan(3);
			for (const size of sizes) {
				expect(size.fontSize).toBe(fontSize);
				if (size.tag !== 'SELECT') {
					expect(size.lineHeight).toBeCloseTo(fontSize * 1.4, 1);
				}
				expect(size.height).toBeCloseTo(
					fontSize * 1.4 + fontSize * 0.5 + 2,
					1,
				);
				expect(
					Math.abs(size.height - sizes[0].height),
				).toBeLessThanOrEqual(0.5);
			}
		}
	});
}

test('authored template fields and reset align above their result count', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	const fruit = page.locator('list-filter[for="fruit"]');
	await expect(fruit.getByRole('searchbox')).toBeVisible();
	await fruit.scrollIntoViewIfNeeded();
	const layout = await fruit.evaluate((element) => {
		const input = element.querySelector('input').getBoundingClientRect();
		const button = element.querySelector('button').getBoundingClientRect();
		const output = element.querySelector('output').getBoundingClientRect();
		return {
			inputBottom: input.bottom,
			buttonBottom: button.bottom,
			outputTop: output.top,
		};
	});
	expect(
		Math.abs(layout.inputBottom - layout.buttonBottom),
	).toBeLessThanOrEqual(0.5);
	expect(layout.outputTop).toBeGreaterThanOrEqual(
		Math.max(layout.inputBottom, layout.buttonBottom),
	);
});
