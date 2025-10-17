import globals from 'globals';
import prettierPlugin from 'eslint-plugin-prettier';
import jest from 'eslint-plugin-jest';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
			},
			globals: {
				...globals.node,
				process: true,
				console: true,
			},
		},
		plugins: {
			prettierPlugin,
		},
	},
	eslint.configs.all,
	tseslint.configs.eslintRecommended,
	tseslint.configs.all,
	{
		rules: {
			radix: 'off',
			camelcase: 'off',
			'one-var': 'off',
			'new-cap': 'off',
			'capitalized-comments': 'off',
			'sort-keys': 'off',
			'sort-imports': 'off',
			'id-length': 'off',
			'max-statements': 'off',
			'max-lines-per-function': 'off',
			'no-console': 'off',
			'no-magic-numbers': 'off',
			'no-underscore-dangle': 'off',
			'no-inline-comments': 'off',
			'no-warning-comments': 'off',
			'no-ternary': 'off',
			'no-nested-ternary': 'off',
			'no-continue': 'off',
			'no-await-in-loop': 'off', // revisar los awaits en los loops por si se puede paralelizar
			'@typescript-eslint/no-unused-vars': 'off', // This rule is already covered by the TypeScript compiler
			'@typescript-eslint/no-invalid-this': 'off', // This rule is already covered by the TypeScript compiler
			'@typescript-eslint/no-magic-numbers': 'off',
			'@typescript-eslint/max-params': 'off',

			curly: ['error', 'multi-or-nest', 'consistent'],
			'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
			'max-lines': [
				'warn',
				{ max: 600, skipBlankLines: true, skipComments: true },
			],
			'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
			'@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
			'@typescript-eslint/no-use-before-define': [
				'error',
				{ functions: false },
			],
			'@typescript-eslint/method-signature-style': ['error', 'method'],
			'@typescript-eslint/dot-notation': [
				'error',
				{ allowIndexSignaturePropertyAccess: true },
			],
			'@typescript-eslint/no-non-null-assertion': 'off', //
			'@typescript-eslint/prefer-readonly-parameter-types': 'off', //
			'@typescript-eslint/strict-boolean-expressions': 'off', //
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					selector: 'default',
					format: ['camelCase'],
					leadingUnderscore: 'allow',
				},
				{ selector: 'variable', format: ['camelCase'] },
				{
					selector: 'variable',
					format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
					modifiers: ['const'],
				},
				{ selector: 'function', format: ['camelCase', 'PascalCase'] },
				{ selector: 'typeLike', format: ['PascalCase'] },
				{ selector: 'enum', format: ['PascalCase'] },
				{ selector: 'typeParameter', format: ['PascalCase'] },
				{ selector: ['enumMember'], format: ['UPPER_CASE'] },
				{ selector: ['objectLiteralProperty', 'typeProperty'], format: null },
				{ selector: 'memberLike', format: ['camelCase', 'snake_case'] },
			],
			'@typescript-eslint/prefer-destructuring': 'off',
		},
	},
	stylistic.configs.all,
	{
		rules: {
			'@stylistic/quote-props': ['error', 'as-needed'],
			'@stylistic/indent': ['error', 'tab', { SwitchCase: 1 }],
			'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
			'@stylistic/linebreak-style': ['error', 'windows'],
			'@stylistic/comma-dangle': ['error', 'always-multiline'],
			'@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
			'@stylistic/dot-location': ['error', 'property'],
			'@stylistic/padded-blocks': ['error', 'never'],
			'@stylistic/arrow-parens': ['error', 'as-needed'],
			'@stylistic/object-curly-spacing': ['error', 'always'],
			'@stylistic/array-element-newline': [
				'error',
				{ consistent: true, multiline: true },
			],
			'@stylistic/array-bracket-spacing': ['error', 'always'],
			'@stylistic/function-call-argument-newline': ['error', 'consistent'],
			'@stylistic/object-property-newline': [
				'error',
				{
					allowAllPropertiesOnSameLine: true,
				},
			],
			'@stylistic/space-before-function-paren': [
				'error',
				{
					anonymous: 'never',
					named: 'never',
					asyncArrow: 'always',
				},
			],
			'@stylistic/function-paren-newline': ['error', 'multiline-arguments'],
			'@stylistic/multiline-comment-style': 'off',
			'@stylistic/lines-between-class-members': [
				'error',
				'always',
				{ exceptAfterSingleLine: true },
			],
			'@stylistic/multiline-ternary': ['error', 'always-multiline'],
			'@stylistic/operator-linebreak': ['error', 'after'],
		},
	},
	jest.configs['flat/recommended'],
	// jsdoc.configs['flat/requirements-typescript']!,
);