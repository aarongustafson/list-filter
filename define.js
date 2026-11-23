import { ListFilterElement } from './list-filter.js';

export function defineListFilter(tagName = 'list-filter') {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get(tagName)) {
		registry.define(tagName, ListFilterElement);
	}

	return true;
}

defineListFilter();
