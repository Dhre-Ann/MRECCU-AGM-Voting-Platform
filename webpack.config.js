const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

module.exports = () => {
  // Load env variables
  const env = dotenv.config().parsed || {};

  // Convert for DefinePlugin
  const envKeys = Object.keys(env).reduce((acc, key) => {
    acc[`process.env.${key}`] = JSON.stringify(env[key]);
    return acc;
  }, {});

  return {
    entry: ['./frontend/src/js/index.js'],
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'frontend/dist'),
    },
    mode: 'development', // or 'production'
    plugins: [
      new webpack.DefinePlugin(envKeys)
    ],
  };
};
