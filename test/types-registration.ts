import '@aarongustafson/list-filter/define.js';

const filter = document.createElement('list-filter');

const refreshed: boolean = filter.refresh();

filter.addEventListener('list-filter:change', (event) => {
	const shown: number = event.detail.shown;
	void shown;
});

void refreshed;
