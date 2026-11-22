import { ListFilterElement } from './list-filter.js';

export function defineComponentName(tagName = 'list-filter'.toLowerCase()) {
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

defineComponentName();
