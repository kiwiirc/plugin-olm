// eslint-disable-next-line import/no-commonjs, import/no-nodejs-modules
const path = require('path')

// eslint-disable-next-line import/no-commonjs
module.exports = {
	mode: 'production',
	output: {
		filename: 'plugin-olm.js',
	},
	node: {
		fs: 'empty',
		net: 'empty',
		tls: 'empty',
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				include: [
					path.resolve(__dirname, 'src'),
					path.resolve(__dirname, 'node_modules', 'olm'),
				],
				loader: 'babel-loader',
				query: {
					presets: [
						[
							'@babel/preset-env',
							{
								useBuiltIns: 'usage',
								targets: {
									browsers: ['last 1 chrome version'],
								},
							},
						],
					],
				},
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader'],
			},
		],
	},
	devtool: 'source-map',
	devServer: {
		filename: 'plugin-olm.js',
		host: process.env.HOST || 'localhost',
		port: process.env.PORT || 53080,
	},
}
