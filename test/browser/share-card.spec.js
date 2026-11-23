import { test, expect } from '@playwright/test';
import { serveDemo } from './demo-fixture.js';

test('share card demonstrates category filtering with real controls and matching counts', async ({
	page,
}) => {
	await serveDemo(page);
	await page.setViewportSize({ width: 1280, height: 640 });
	await page.goto('http://code-demo.test/share-card/index.html');
	const full = page.locator('list-filter[for="all-resources"]');
	const filtered = page.locator('list-filter[for="filtered-resources"]');
	await expect(full.locator('output')).toHaveText('4 resources');
	await expect(filtered.locator('output')).toHaveText('4 resources');
	await filtered.locator('select').selectOption('CSS');
	await expect(filtered.locator('output')).toHaveText('2 resources');
	await expect(page.locator('#all-resources > li:visible')).toHaveCount(4);
	await expect(page.locator('#filtered-resources > li:visible')).toHaveText([
		'CSS layout essentials',
		'CSS color reference',
	]);
	expect(
		await page.evaluate(
			() =>
				document.documentElement.scrollWidth === 1280 &&
				document.documentElement.scrollHeight === 640,
		),
	).toBe(true);
});
