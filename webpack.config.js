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
				exclude: /node_modules/,
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
		],
	},
	devtool: 'source-map',
	devServer: {
		filename: 'plugin-olm.js',
		host: process.env.HOST || 'localhost',
		port: 53080,
	},
}
