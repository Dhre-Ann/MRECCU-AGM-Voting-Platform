const path = require('path');

module.exports = {
  entry: ['./frontend/src/js/index.js'],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'frontend/dist'),
  },
  mode: 'development',
};