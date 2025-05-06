// public/config/webpack.config.js

import path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  mode: 'development',
  entry: './public/js/init.js',
  output: {
    path: path.resolve(__dirname, '../../public'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.js'],
    fallback: {
      fs: false, // ignore Node.js-only modules
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve(__dirname, '../../public/js'),
        use: 'babel-loader',
      },
    ],
  },
  plugins: [
    // ⛔️ Strip moment locales unless needed
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
  ],
  devtool: 'source-map',
};
