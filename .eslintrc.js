module.exports = {
	env: {
		commonjs: true,
		es2021: true,
		node: true,
	},
	extends: [
		'eslint:recommended'
	],
	parser: 'babel-eslint',
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 12,
	},
	rules: {
		'no-return-assign': 'error',
		'no-sequences': 'error',
		'no-alert': 'error',
		'no-caller': 'error',
		'no-constructor-return': 'error',
		'no-div-regex': 'error',
		'no-else-return': 'error',
		'no-empty-function': 'error',
		'no-eq-null': 'error',
		'no-eval': 'error',
		'no-extend-native': 'error',
		'no-extra-bind': 'error',
		'no-extra-label': 'error',
		'no-floating-decimal': 'error',
		'no-implicit-coercion': 'error',
		'no-implied-eval': 'error',
		'no-invalid-this': 'error',
		'no-iterator': 'error',
		'no-implicit-globals': 'error',
		'no-loop-func': 'error',
		'no-useless-concat': 'error',
		'no-extra-parens': 'error',
		'no-loss-of-precision': 'error',
		'no-unused-expressions': 'error',
		'no-unmodified-loop-condition': 'error',
		'no-throw-literal': 'error',
		'no-self-compare': 'error',
		'no-script-url': 'error',
		'no-octal-escape': 'error',
		'no-proto': 'error',
		'no-new-wrappers': 'error',
		'no-new-func': 'error',
		'no-multi-spaces': 'error',
		'no-multi-str': 'error',
		'no-new': 'error',
		'no-lone-blocks': 'error',
		'no-template-curly-in-string': 'error',
		'no-promise-executor-return': 'error',
		'no-unreachable-loop': 'error',
		'no-array-constructor': 'error',
		'no-lonely-if': 'error',
		'no-negated-condition': 'error',
		'no-nested-ternary': 'error',
		'no-new-object': 'error',
		'no-trailing-spaces': 'error',
		'no-unneeded-ternary': 'error',
		'no-whitespace-before-property': 'error',
		'no-confusing-arrow': 'error',
		'no-useless-constructor': 'error',
		'no-void': 'error',
		'no-undef-init': 'error',
		'no-undefined': 'error',
		'no-useless-return': 'error',
		'no-var': 'error',
		'no-use-before-define': [
			'error',
			'nofunc'
		],
		'no-multiple-empty-lines': [
			'error',
			{
				max: 2,
				maxEOF: 1,
				maxBOF: 0,
			}
		],
		'no-empty': [
			'error',
			{
				allowEmptyCatch: true,
			}
		],
		'no-mixed-spaces-and-tabs': [
			'error',
			'smart-tabs'
		],
		'no-duplicate-imports': [
			'error',
			{
				includeExports: true,
			}
		],
		'no-useless-computed-key': [
			'error',
			{
				enforceForClassMembers: true,
			}
		],
		'no-shadow': [
			'error',
			{
				builtinGlobals: true,
			}
		],

		'prefer-arrow-callback': 'error',
		'prefer-const': ['error', {
			destructuring: 'all',
			ignoreReadBeforeAssign: false,
		}],
		'prefer-numeric-literals': 'error',
		'prefer-rest-params': 'error',
		'prefer-spread': 'error',
		'prefer-promise-reject-errors': 'error',
		'prefer-regex-literals': 'error',
		'prefer-exponentiation-operator': 'error',

		semi: [
			'error',
			'always'
		],
		'semi-spacing': 'error',
		'semi-style': [
			'error',
			'last'
		],

		'comma-spacing': 'error',
		'comma-dangle': [
			'error',
			{
				objects: 'always-multiline',
			}
		],

		quotes: [
			'error',
			'single',
			{
				avoidEscape: true,
			}
		],
		'quote-props': [
			'error',
			'as-needed'
		],

		'arrow-spacing': 'error',
		'arrow-body-style': [
			'error',
			'as-needed'
		],
		'arrow-parens': [
			'error',
			'as-needed'
		],

		'template-curly-spacing': 'error',
		'template-tag-spacing': [
			'error',
			'always'
		],

		'space-in-parens': [
			'error',
			'never'
		],
		'space-before-blocks': [
			'error',
			'never'
		],
		'space-before-function-paren': [
			'error',
			{
				anonymous: 'always',
				named: 'never',
				asyncArrow: 'always',
			}
		],

		'object-curly-spacing': ['error', 'always', {
			arraysInObjects: false,
		}],
		'object-curly-newline': [
			'error',
			{
				multiline: true,
				consistent: true,
			}
		],
		complexity: 'error',
		'dot-location': [
			'error',
			'property'
		],
		eqeqeq: 'error',
		indent: [
			'error',
			'tab',
			{
				SwitchCase: 1,
			}
		],
		'linebreak-style': 'error',
		'block-scoped-var': 'error',
		'class-methods-use-this': 'error',
		'array-callback-return': 'error',
		'default-case': 'error',
		'default-case-last': 'error',
		'default-param-last': 'error',
		'guard-for-in': 'error',
		'grouped-accessor-pairs': 'error',
		'max-classes-per-file': [
			'error',
			3
		],
		yoda: 'error',
		radix: 'warn',
		'switch-colon-spacing': [
			'error',
			{
				after: false,
			}
		],
		'wrap-regex': 'error',
		'symbol-description': 'error',
		'vars-on-top': 'error',
		'require-await': 'error',
		'spaced-comment': [
			'error',
			'always',
			{
				block: {
					exceptions: [
						'-'
					],
				},
			}
		],
		'yield-star-spacing': [
			'error',
			'after'
		],
		'rest-spread-spacing': [
			'error',
			'never'
		],
		'unicode-bom': [
			'error',
			'never'
		],
		'func-call-spacing': [
			'error',
			'never'
		],
		'newline-per-chained-call': [
			'error',
			{
				ignoreChainWithDepth: 3,
			}
		],
		'new-parens': [
			'error',
			'never'
		],
		'wrap-iife': [
			'error',
			'inside'
		],
		'generator-star-spacing': [
			'error',
			{
				before: false,
				after: true,
			}
		],
		'nonblock-statement-body-position': [
			'error',
			'beside',
			{
				overrides: {},
			}
		],
		'padded-blocks': [
			'error',
			'never'
		],
		'accessor-pairs': 'error',
		'space-unary-ops': 'error',
		'no-useless-rename': 'error',
		'object-shorthand': 'error',
		'prefer-destructuring': [
			'error',
			{
				array: true,
				object: true,
			},
			{
				enforceForRenamedProperties: false,
			}
		],
		'operator-linebreak': [
			'error',
			'after',
			{
				overrides: {},
			}
		],
		'operator-assignment': [
			'error',
			'always'
		],
		'keyword-spacing': [
			'error',
			{
				before: false,
				after: false,
				overrides: {
					return: {
						before: true,
						after: true,
					},
					from: {
						before: true,
						after: true,
					},

					continue: {
						before: true,
					},
					extends: {
						before: true,
					},
					throw: {
						before: true,
					},
					break: {
						before: true,
					},
					await: {
						before: true,
					},
					this: {
						before: true,
					},

					function: {
						after: true,
					},
					default: {
						after: true,
					},
					typeof: {
						after: true,
					},
					export: {
						after: true,
					},
					import: {
						after: true,
					},
					const: {
						after: true,
					},
					case: {
						after: true,
					},
					get: {
						after: true,
					},
					set: {
						after: true,
					},
				},
			}
		],
	},
};