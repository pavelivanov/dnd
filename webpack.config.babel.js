import path from 'path'
import webpack from 'webpack'
import UglifyJsPlugin from 'uglifyjs-webpack-plugin'


const globals = {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
}


export default {
  entry: './src/index',
  mode: process.env.NODE_ENV,
  devtool: 'none',

  output: {
    path: path.resolve(__dirname, 'example'),
    filename: 'dnd.js',
    libraryTarget: 'umd',
    libraryExport: 'default',
    library: 'DND',
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      }
    ]
  },

  plugins: [
    new webpack.DefinePlugin(globals),
    ...(
      process.env.NODE_ENV === 'production' ? [
        new UglifyJsPlugin({
          comments: false,
          compress: {
            pure_getters: true,
            unsafe: true,
            unsafe_comps: true,
            warnings: false,
            screw_ie8: true,
          },
        }),
      ] : []
    ),
  ]
}
