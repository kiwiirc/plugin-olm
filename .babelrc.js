module.exports = {
	presets: [
		[
			'@babel/preset-env',
			{
				useBuiltIns: 'usage',
				corejs: 3,
				targets: {
					node: 'current',
				},
			},
		],
	],
	plugins: [
		['@babel/plugin-proposal-object-rest-spread', { useBuiltIns: true }],
		['@babel/plugin-syntax-decorators', { legacy: true }],
		['@babel/plugin-proposal-decorators', { legacy: true }],
		['@babel/plugin-proposal-class-properties', { loose: true }],
		// 'babel-plugin-espower',
	],
}
