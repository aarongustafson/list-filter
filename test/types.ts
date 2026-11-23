import {
	ListFilterElement,
	type ListFilterChangeDetail,
	type ListFilterErrorDetail,
} from '@aarongustafson/list-filter';
import { defineListFilter } from '@aarongustafson/list-filter/define.js';

const filter: ListFilterElement = document.createElement('list-filter');
filter.htmlFor = 'items';
filter.htmlFor = null;
filter.htmlFor = undefined;
filter.search = true;
filter.categories = false;
const refreshed: boolean = filter.refresh();
const reset: boolean = filter.reset();
const registered: boolean = defineListFilter();

filter.addEventListener('list-filter:change', (event) => {
	const detail: ListFilterChangeDetail = event.detail;
	const count: number = detail.shown;
	const reason: 'init' | 'refresh' | 'search' | 'category' | 'reset' =
		detail.reason;
	void [count, reason];
});
filter.addEventListener('list-filter:error', (event) => {
	const detail: ListFilterErrorDetail = event.detail;
	const message: string = detail.message;
	void message;
});

// @ts-expect-error Boolean presence properties do not accept search modes.
filter.search = 'fuzzy';
// @ts-expect-error The component emits structured count details, not strings.
const invalid: ListFilterChangeDetail = { shown: '3' };
void [refreshed, reset, registered, invalid];
