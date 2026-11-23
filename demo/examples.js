const recovery = document.getElementById('recovery');
document.getElementById('repair').addEventListener('click', () => {
	recovery.htmlFor = 'recovery-list';
});

const status = document.getElementById('component-status');
try {
	await import('../define.js');
	status.hidden = true;
} catch (error) {
	console.error('Filter controls could not load.', error);
	status.textContent = status.dataset.failureMessage;
	status.hidden = false;
}
