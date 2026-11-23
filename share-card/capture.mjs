import { writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

if (!process.argv[2])
	throw new Error('Usage: node share-card/capture.mjs http://127.0.0.1:PORT');
const base = new URL(process.argv[2]);
if (base.hostname !== '127.0.0.1' || base.protocol !== 'http:') {
	throw new Error(
		'Pass the managed local preview URL: http://127.0.0.1:PORT',
	);
}
const browser = await chromium.launch();
try {
	const context = await browser.newContext({
		viewport: { width: 1280, height: 640 },
		deviceScaleFactor: 2,
		locale: 'en-US',
		colorScheme: 'light',
		reducedMotion: 'reduce',
		timezoneId: 'UTC',
	});
	const page = await context.newPage();
	const failures = [];
	page.on('pageerror', (error) => failures.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') failures.push(message.text());
	});
	page.on('requestfailed', (request) =>
		failures.push(`${request.url()}: ${request.failure()?.errorText}`),
	);
	page.on('response', (response) => {
		if (response.status() >= 400)
			failures.push(`${response.status()}: ${response.url()}`);
	});
	await page.route('**/*', (route) => {
		if (new URL(route.request().url()).origin !== base.origin) {
			failures.push(
				`Unexpected external request: ${route.request().url()}`,
			);
			return route.abort();
		}
		return route.continue();
	});
	await page.goto(new URL('/share-card/index.html', base).href);
	await page.evaluate(async () => {
		await customElements.whenDefined('list-filter');
		await document.fonts.ready;
		for (const weight of [400, 700]) {
			const fonts = await document.fonts.load(
				`${weight} 26px "Share Card Arial"`,
			);
			if (!fonts.length || fonts.some((font) => font.status !== 'loaded'))
				throw new Error(`Install Arial ${weight} before capturing.`);
		}
		await Promise.all(
			[...document.images].map(async (image) => {
				await image.decode();
				if (!image.naturalWidth)
					throw new Error('An image did not load.');
			}),
		);
	});
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
	await page.locator('select:focus').evaluateAll((controls) => {
		for (const control of controls) control.blur();
	});
	await page.mouse.move(16, 16);
	expect(
		await page.evaluate(
			() =>
				document.documentElement.scrollWidth === 1280 &&
				document.documentElement.scrollHeight === 640,
		),
		'The artwork must fit the canvas without scrolling.',
	).toBe(true);
	const master = await page.screenshot({
		type: 'png',
		animations: 'disabled',
	});
	const exports = await page.evaluate(
		async (data) => {
			const image = new Image();
			image.src = data;
			await image.decode();
			if (image.width !== 2560 || image.height !== 1280)
				throw new Error('The master must be 2560 x 1280.');
			function render(source, width, height) {
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(source, 0, 0, width, height);
				const pixels = ctx.getImageData(0, 0, width, height).data;
				for (let i = 3; i < pixels.length; i += 4) {
					if (pixels[i] !== 255)
						throw new Error('Export is not opaque.');
				}
				return canvas;
			}
			render(image, 2560, 1280);
			const final = render(image, 1280, 640);
			return [
				final.toDataURL('image/png'),
				render(final, 640, 320).toDataURL('image/png'),
			];
		},
		`data:image/png;base64,${master.toString('base64')}`,
	);
	expect(
		failures,
		'Capture failed; fix these errors before exporting.',
	).toEqual([]);
	const final = Buffer.from(exports[0].split(',')[1], 'base64');
	const preview = Buffer.from(exports[1].split(',')[1], 'base64');
	if (final.length >= 1_000_000)
		throw new Error(`Final export is too large: ${final.length} bytes.`);
	await Promise.all([
		writeFile(new URL('./hero@2x.png', import.meta.url), master),
		writeFile(new URL('./hero.png', import.meta.url), final),
		writeFile(new URL('./preview.png', import.meta.url), preview),
	]);
	console.log(
		JSON.stringify({
			browser: browser.version(),
			font: 'Arial, Arial Bold (local)',
			master: { width: 2560, height: 1280, bytes: master.length },
			final: { width: 1280, height: 640, bytes: final.length },
			preview: { width: 640, height: 320, bytes: preview.length },
			opaque: true,
		}),
	);
} finally {
	await browser.close();
}
