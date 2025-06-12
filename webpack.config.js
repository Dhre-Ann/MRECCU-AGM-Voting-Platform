const path = require('path');
const webpack = require('webpack');

module.exports = () => {
  const env = {
    API_BASE_URL: process.env.API_BASE_URL
  };

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
    mode: 'production',
    plugins: [
      new webpack.DefinePlugin(envKeys)
    ],
  };
};
