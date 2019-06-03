/* eslint-disable import/no-commonjs, import/no-nodejs-modules */
const path = require('path')
const CompressionPlugin = require('compression-webpack-plugin')
const BrotliPlugin = require('brotli-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const StatsPlugin = require('stats-webpack-plugin')

const shouldCompress = /\.(js|css|html|svg)(\.map)?$/

// eslint-disable-next-line import/no-commonjs
module.exports = function(env, argv) {
	const babelLoaderOptions = {}
	if (argv.mode !== 'production') {
		// minimal transpiling for easier debugging in development
		babelLoaderOptions.options = {
			presets: [
				[
					'@babel/preset-env',
					{
						useBuiltIns: 'usage',
						corejs: 3,
						targets: { browsers: 'last 1 Chrome versions' },
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
	}

	const config = {
		entry: {
			[require('./package.json').name]: '.',
		},
		mode: argv.mode,
		output: {
			filename: '[name].js',
			chunkFilename: '[name].js',
		},
		node: {
			fs: 'empty',
			net: 'empty',
			tls: 'empty',
		},
		resolve: {
			symlinks: false,
		},
		plugins: [
			new CleanWebpackPlugin(),
			new StatsPlugin('stats.json', {
				chunkModules: true,
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
					...babelLoaderOptions,
				},
				{
					test: /\.css$/,
					use: ['style-loader', 'css-loader'],
				},
			],
		},
		// // kiwi's plugin loader doesn't work with split chunks
		// optimization: {
		// 	splitChunks: {
		// 		chunks: 'all',
		// 	},
		// },
		devtool: 'source-map',
		devServer: {
			filename: 'plugin-olm.js',
			host: process.env.HOST || 'localhost',
			port: process.env.PORT || 53080,
		},
	}

	if (argv.mode === 'production') {
		config.plugins = [
			...config.plugins,
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
		]
	}

	return config
}
