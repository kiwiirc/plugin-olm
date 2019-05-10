/* eslint-disable import/no-commonjs, import/no-nodejs-modules */
const path = require('path')
const CompressionPlugin = require('compression-webpack-plugin')
const BrotliPlugin = require('brotli-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')

const shouldCompress = /\.(js|css|html|svg)(\.map)?$/

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
	plugins: [
		new CleanWebpackPlugin(),
		new CompressionPlugin({
			test: shouldCompress,
		}),
		new BrotliPlugin({
			asset: '[path].br[query]',
			test: shouldCompress,
			threshold: 10240,
			minRatio: 0.8,
			deleteOriginalAssets: false,
		}),
	],
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
