import { beforeAll } from 'vitest';
import { ListFilterElement } from '../list-filter.js';

const elementName = 'list-filter'.toLowerCase();

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get(elementName)) {
		customElements.define(elementName, ListFilterElement);
	}

	// Make the class available globally for testing static methods
	globalThis.ListFilterElement = ListFilterElement;
});
