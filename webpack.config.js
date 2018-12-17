const path = require('path')

module.exports = {
	mode: 'development',
	entry: './src/plugin-olm.js',
	output: {
		filename: 'plugin-olm.js',
	},
	node: {
		fs: 'empty',
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
		port: 53080,
	},
}
