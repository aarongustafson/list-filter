export interface ListFilterChangeDetail {
	reason: 'init' | 'refresh' | 'search' | 'category' | 'reset';
	search: string;
	category: string;
	shown: number;
	total: number;
}

export interface ListFilterErrorDetail {
	code:
		| 'disconnected'
		| 'invalid-list'
		| 'list-owned'
		| 'invalid-search'
		| 'invalid-announce'
		| 'invalid-categories-map'
		| 'invalid-language'
		| 'invalid-template'
		| 'not-ready';
	message: string;
}

/** Light-DOM controls for filtering direct native list children. */
export class ListFilterElement extends HTMLElement {
	static readonly observedAttributes: string[];
	get htmlFor(): string;
	set htmlFor(value: string | null | undefined);
	search: boolean;
	categories: boolean;
	connectedCallback(): void;
	disconnectedCallback(): void;
	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null,
	): void;
	/** Refresh list content, configuration, and options; false on reported errors. */
	refresh(): boolean;
	/** Clear this component's filters without resetting an enclosing form. */
	reset(): boolean;
}

declare global {
	interface HTMLElementTagNameMap {
		'list-filter': ListFilterElement;
	}
	interface HTMLElementEventMap {
		'list-filter:change': CustomEvent<ListFilterChangeDetail>;
		'list-filter:error': CustomEvent<ListFilterErrorDetail>;
	}
}
