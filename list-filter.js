const owners = new WeakMap();
const pluralCategories = ['zero', 'one', 'two', 'few', 'many', 'other'];
let nextId = 0;

function restoreHidden(node, record) {
	if (node.getAttribute('hidden') !== record.current) return;
	if (record.original === null) node.removeAttribute('hidden');
	else node.setAttribute('hidden', record.original);
}

export class ListFilterElement extends HTMLElement {
	static observedAttributes = [
		'for',
		'search',
		'categories',
		'title',
		'search-label',
		'search-placeholder',
		'categories-label',
		'categories-placeholder',
		'categories-map',
		'reset-label',
		'output-label',
		'announce',
		'lang',
		...pluralCategories.map((category) => `output-label-${category}`),
	];

	constructor() {
		super();
		this._items = new Map();
		this._ui = null;
		this._list = null;
		this._scheduled = false;
		this._timer = null;
		this._focusCleanup = null;
		this._onSearch = () => this._apply('search');
		this._onCategory = () => this._apply('category');
		this._onReset = () => this.reset();
	}

	get htmlFor() {
		return this.getAttribute('for') ?? '';
	}

	set htmlFor(value) {
		if (value == null) this.removeAttribute('for');
		else this.setAttribute('for', value);
	}

	get search() {
		return this.hasAttribute('search');
	}

	set search(value) {
		this.toggleAttribute('search', Boolean(value));
	}

	get categories() {
		return this.hasAttribute('categories');
	}

	set categories(value) {
		this.toggleAttribute('categories', Boolean(value));
	}

	connectedCallback() {
		for (const property of ['htmlFor', 'search', 'categories']) {
			if (Object.hasOwn(this, property)) {
				const value = this[property];
				delete this[property];
				this[property] = value;
			}
		}
		this._schedule();
	}

	disconnectedCallback() {
		this._cleanup();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue !== newValue && this.isConnected) this._schedule();
	}

	_schedule() {
		if (this._scheduled) return;
		this._scheduled = true;
		queueMicrotask(() => {
			this._scheduled = false;
			if (this.isConnected) this.refresh();
		});
	}

	_error(code, message) {
		const list = this._list;
		const restoreFocus = this._ui?.wrapper.contains(
			this.getRootNode().activeElement,
		);
		this._cleanup();
		if (restoreFocus) this._focusList(list);
		console.error(`[list-filter] ${message}`);
		this.dispatchEvent(
			new CustomEvent('list-filter:error', {
				bubbles: true,
				composed: true,
				detail: { code, message },
			}),
		);
		return false;
	}

	_focusList(list = this._list) {
		if (!list?.isConnected) return;
		this._focusCleanup?.();
		if (!list.hasAttribute('tabindex')) {
			list.setAttribute('tabindex', '-1');
			const restore = () => {
				this._focusCleanup = null;
				list.removeEventListener('blur', restore);
				if (list.getAttribute('tabindex') === '-1')
					list.removeAttribute('tabindex');
			};
			list.addEventListener('blur', restore);
			this._focusCleanup = restore;
		}
		list.focus({ preventScroll: true });
	}

	_recoverFocus(preferred) {
		for (const control of [
			preferred,
			this._ui.search,
			this._ui.categories,
			this._ui.reset,
		]) {
			if (!control || control.matches(':disabled')) continue;
			control.focus();
			if (this.getRootNode().activeElement === control) return;
		}
		this._focusList();
	}

	refresh() {
		if (!this.isConnected) {
			return this._error(
				'disconnected',
				'Connect the component before calling refresh().',
			);
		}
		const root = this.getRootNode();
		const list = root.getElementById(this.htmlFor);
		if (
			!list ||
			!['OL', 'UL', 'DL'].includes(list.tagName) ||
			list.contains(this)
		) {
			return this._error(
				'invalid-list',
				'for must reference an ol, ul, or dl outside the component.',
			);
		}
		if (owners.has(list) && owners.get(list) !== this) {
			return this._error(
				'list-owned',
				'The list already has a list-filter owner.',
			);
		}
		if (this.search && this.getAttribute('search') !== '') {
			return this._error(
				'invalid-search',
				'Use the empty search attribute; fuzzy modes are not supported.',
			);
		}
		const announce = this.getAttribute('announce') ?? 'polite';
		if (!['polite', 'off'].includes(announce)) {
			return this._error(
				'invalid-announce',
				'announce must be polite or off.',
			);
		}
		let categoryMap = {};
		if (this.hasAttribute('categories-map')) {
			try {
				categoryMap = JSON.parse(this.getAttribute('categories-map'));
			} catch (error) {
				if (!(error instanceof SyntaxError)) throw error;
				return this._error(
					'invalid-categories-map',
					'categories-map must be a JSON object of string labels.',
				);
			}
			if (
				!categoryMap ||
				Array.isArray(categoryMap) ||
				typeof categoryMap !== 'object' ||
				Object.values(categoryMap).some(
					(label) => typeof label !== 'string',
				)
			) {
				return this._error(
					'invalid-categories-map',
					'categories-map must be a JSON object of string labels.',
				);
			}
		}
		let language = 'en';
		for (
			let ancestor = this;
			ancestor;
			ancestor = ancestor.parentElement ?? ancestor.getRootNode().host
		) {
			if (ancestor.hasAttribute('lang')) {
				language = ancestor.getAttribute('lang') || 'en';
				break;
			}
		}
		let plurals;
		try {
			plurals = new Intl.PluralRules(language);
		} catch (error) {
			if (!(error instanceof RangeError)) throw error;
			return this._error(
				'invalid-language',
				'Provide a valid language tag for plural labels.',
			);
		}
		const templates = [...this.children].filter(
			(child) => child.tagName === 'TEMPLATE',
		);
		if (templates.length > 1) {
			return this._error(
				'invalid-template',
				'Provide at most one direct-child template.',
			);
		}
		const template = templates[0] ?? null;
		const signature = JSON.stringify([
			language,
			template?.innerHTML,
			...ListFilterElement.observedAttributes.map((name) =>
				this.getAttribute(name),
			),
		]);
		const rebuild =
			!this._ui ||
			this._list !== list ||
			this._signature !== signature ||
			this._template !== template;
		const previous =
			this._ui && this._list === list
				? {
						search: this._ui.search?.value ?? '',
						category: this._ui.categories?.value ?? '',
					}
				: null;
		const restoreFocus = this._ui?.wrapper.contains(root.activeElement);
		const focusedRef =
			this._ui &&
			Object.entries(this._ui).find(
				([, node]) => node === root.activeElement,
			)?.[0];
		if (rebuild) {
			const ui = this._createUI(template);
			if (!ui) return false;
			this._cleanup();
			this._ui = ui;
			this._list = list;
			this._template = template;
			this._signature = signature;
			owners.set(list, this);
			this.append(ui.wrapper);
			ui.search?.addEventListener('input', this._onSearch);
			ui.categories?.addEventListener('change', this._onCategory);
			ui.reset.addEventListener('click', this._onReset);
			if (previous && ui.search) ui.search.value = previous.search;
		}
		this._plurals = plurals;
		this._announce = announce;
		this._capture();
		const selected = previous?.category ?? this._ui.categories?.value ?? '';
		if (this._ui.categories) {
			const values = [
				...new Set(
					[...this._items.values()]
						.filter(
							(item) =>
								item.original === null &&
								item.category !== null &&
								item.category !== '',
						)
						.map((item) => item.category),
				),
			];
			const options = [
				this._option(
					'',
					this.getAttribute('categories-placeholder') ?? 'All',
				),
				...values.map((value) =>
					this._option(
						value,
						Object.hasOwn(categoryMap, value)
							? categoryMap[value]
							: value,
					),
				),
			];
			this._ui.categories.replaceChildren(...options);
			this._ui.categories.value = values.includes(selected)
				? selected
				: '';
		}
		const appliedUI = this._ui;
		this._apply(previous ? 'refresh' : 'init');
		if (
			restoreFocus &&
			rebuild &&
			this.isConnected &&
			this._ui === appliedUI
		) {
			this._recoverFocus(appliedUI[focusedRef]);
		}
		return true;
	}

	_option(value, label) {
		const option = this.ownerDocument.createElement('option');
		option.value = value;
		option.textContent = label;
		return option;
	}

	_createUI(template) {
		const doc = this.ownerDocument;
		const wrapper = doc.createElement('div');
		wrapper.setAttribute('data-list-filter-generated', '');
		if (template) wrapper.append(template.content.cloneNode(true));
		else {
			const id = `list-filter-${++nextId}`;
			const fieldset = doc.createElement('fieldset');
			fieldset.style.minInlineSize = '0';
			const legend = doc.createElement('legend');
			legend.textContent =
				this.getAttribute('title') ?? 'Filter this list';
			const row = doc.createElement('div');
			row.setAttribute('data-list-filter-controls', '');
			row.style.cssText =
				'display:flex;flex-wrap:wrap;align-items:end;gap:var(--list-filter-gap,1rem)';
			for (const [enabled, ref, tag, labelText] of [
				[
					this.search,
					'search',
					'input',
					this.getAttribute('search-label') ?? 'By search term',
				],
				[
					this.categories,
					'categories',
					'select',
					this.getAttribute('categories-label') ?? 'By category',
				],
			]) {
				if (!enabled) continue;
				const block = doc.createElement('div');
				block.style.cssText =
					'display:flex;flex-direction:column;gap:0.25rem;min-inline-size:0';
				const label = doc.createElement('label');
				const control = doc.createElement(tag);
				control.id = `${id}-${ref}`;
				control.style.cssText =
					'max-inline-size:100%;box-sizing:border-box';
				control.setAttribute('data-list-filter-ref', ref);
				label.htmlFor = control.id;
				label.textContent = labelText;
				if (ref === 'search') {
					control.type = 'search';
					if (this.hasAttribute('search-placeholder')) {
						control.placeholder =
							this.getAttribute('search-placeholder');
					}
				}
				block.append(label, control);
				row.append(block);
			}
			const reset = doc.createElement('button');
			reset.type = 'button';
			reset.textContent =
				this.getAttribute('reset-label') ?? 'Reset filters';
			reset.setAttribute('data-list-filter-ref', 'reset');
			const output = doc.createElement('output');
			output.setAttribute('data-list-filter-ref', 'output');
			row.append(reset);
			fieldset.append(legend, row, output);
			wrapper.append(fieldset);
		}
		const ui = { wrapper };
		for (const [ref, tag, required] of [
			['search', 'INPUT', this.search],
			['categories', 'SELECT', this.categories],
			['reset', 'BUTTON', true],
			['output', 'OUTPUT', true],
		]) {
			const matches = wrapper.querySelectorAll(
				`[data-list-filter-ref="${ref}"]`,
			);
			if (
				(!required && matches.length) ||
				(required &&
					(matches.length !== 1 ||
						matches[0].tagName !== tag ||
						(ref === 'search' && matches[0].type !== 'search') ||
						(ref === 'reset' && matches[0].type !== 'button')))
			) {
				this._error(
					'invalid-template',
					`Provide exactly one valid ${ref} ref when its control is enabled.`,
				);
				return null;
			}
			ui[ref] = matches[0] ?? null;
		}
		ui.output.setAttribute('aria-live', 'off');
		const status = doc.createElement('span');
		status.setAttribute('data-list-filter-ref', 'status');
		status.setAttribute('role', 'status');
		status.setAttribute('aria-atomic', 'true');
		status.style.cssText =
			'position:absolute;inline-size:1px;block-size:1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
		wrapper.append(status);
		ui.status = status;
		return ui;
	}

	_capture() {
		const tag = this._list.tagName === 'DL' ? 'DIV' : 'LI';
		const children = new Set(
			[...this._list.children].filter((child) => child.tagName === tag),
		);
		for (const [node, record] of this._items) {
			if (!children.has(node)) {
				restoreHidden(node, record);
				this._items.delete(node);
			}
		}
		for (const node of children) {
			let record = this._items.get(node);
			if (!record) {
				record = {
					original: node.getAttribute('hidden'),
					current: node.getAttribute('hidden'),
				};
				this._items.set(node, record);
			} else if (node.getAttribute('hidden') !== record.current) {
				record.original = node.getAttribute('hidden');
			}
			record.current = node.getAttribute('hidden');
			record.text = node.textContent.toLowerCase();
			record.category = node.getAttribute('data-category');
		}
	}

	reset() {
		if (!this._ui)
			return this._error(
				'not-ready',
				'Initialize valid controls before calling reset().',
			);
		if (this._ui.search) this._ui.search.value = '';
		if (this._ui.categories) this._ui.categories.value = '';
		this._apply('reset');
		return true;
	}

	_apply(reason) {
		const search = this._ui.search?.value ?? '';
		const category = this._ui.categories?.value ?? '';
		const needle = search.toLowerCase();
		let shown = 0;
		let total = 0;
		for (const [node, record] of this._items) {
			if (node.getAttribute('hidden') !== record.current) {
				record.original = node.getAttribute('hidden');
				record.current = record.original;
			}
			if (record.original !== null) continue;
			total++;
			const matches =
				record.text.includes(needle) &&
				(!category || record.category === category);
			if (matches) shown++;
			if (!matches && node.contains(this.getRootNode().activeElement)) {
				this._recoverFocus();
			}
			if (matches && node.hasAttribute('hidden'))
				node.removeAttribute('hidden');
			else if (!matches && !node.hasAttribute('hidden'))
				node.setAttribute('hidden', '');
			record.current = node.getAttribute('hidden');
		}
		const categoryName = this._plurals.select(shown);
		const base = this.getAttribute('output-label');
		const label =
			this.getAttribute(`output-label-${categoryName}`) ??
			base ??
			(shown === 1 ? '{count} item' : '{count} items');
		const message = label.replaceAll('{count}', String(shown));
		if (this._ui.output.textContent !== message)
			this._ui.output.textContent = message;
		clearTimeout(this._timer);
		this._timer = null;
		this._ui.status.setAttribute('aria-live', this._announce);
		if (reason !== 'init' && this._announce !== 'off') {
			if (reason === 'search') {
				this._timer = setTimeout(() => {
					this._timer = null;
					this._ui.status.textContent = message;
				}, 300);
			} else this._ui.status.textContent = message;
		}
		this.dispatchEvent(
			new CustomEvent('list-filter:change', {
				bubbles: true,
				composed: true,
				detail: { reason, search, category, shown, total },
			}),
		);
	}

	_cleanup() {
		this._focusCleanup?.();
		clearTimeout(this._timer);
		this._timer = null;
		for (const [node, record] of this._items) restoreHidden(node, record);
		this._items.clear();
		if (this._list && owners.get(this._list) === this)
			owners.delete(this._list);
		this._ui?.search?.removeEventListener('input', this._onSearch);
		this._ui?.categories?.removeEventListener('change', this._onCategory);
		this._ui?.reset.removeEventListener('click', this._onReset);
		this._ui?.wrapper.remove();
		this._ui = null;
		this._list = null;
	}
}
