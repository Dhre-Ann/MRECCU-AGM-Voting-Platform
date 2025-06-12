const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load environment variables from .env
const env = dotenv.config().parsed || {};

// Convert to a form DefinePlugin expects
const envKeys = Object.keys(env).reduce((acc, key) => {
  acc[`process.env.${key}`] = JSON.stringify(env[key]);
  return acc;
}, {});

module.exports = {
  entry: ['./frontend/src/js/index.js'],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'frontend/dist'),
  },
  mode: 'development', // Or 'production'
  plugins: [
    new webpack.DefinePlugin(envKeys)
  ],
};
