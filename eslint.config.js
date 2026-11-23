import eslintConfig from '@open-wc/eslint-config';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
	...eslintConfig,
	eslintConfigPrettier,
	{
		files: ['share-card/capture.mjs'],
		rules: {
			'import-x/no-extraneous-dependencies': [
				'error',
				{ devDependencies: true },
			],
		},
	},
	{
		ignores: [
			'node_modules/**',
			'coverage/**',
			'demo/**',
			'test/types.ts',
			'test/types-registration.ts',
		],
	},
];
