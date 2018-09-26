import path from 'path'
import webpack from 'webpack'


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
  ],
}
