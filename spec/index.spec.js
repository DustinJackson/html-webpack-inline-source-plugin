/* eslint-env jasmine */
var path = require('path');
var fs = require('fs');
var cheerio = require('cheerio');
var webpack = require('webpack');
var rm_rf = require('rimraf');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var HtmlWebpackInlineSourcePlugin = require('../');

var OUTPUT_DIR = path.join(__dirname, '../dist');

describe('HtmlWebpackInlineSourcePlugin', function () {
  beforeEach(function (done) {
    rm_rf(OUTPUT_DIR, done);
  });

  it('should not inline source by default', function (done) {
    webpack({
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        path: OUTPUT_DIR
      },
      module: {
        loaders: [{ test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }]
      },
      plugins: [
        new ExtractTextPlugin('style.css'),
        new HtmlWebpackPlugin(),
        new HtmlWebpackInlineSourcePlugin()
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      var htmlFile = path.resolve(__dirname, '../dist/index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        var $ = cheerio.load(data);
        expect($('script[src="bundle.js"]').html()).toBe('');
        expect($('link[href="style.css"]').html()).toBe('');
        done();
      });
    });
  });

  it('should embed sources inline when regex matches file names', function (done) {
    webpack({
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        path: OUTPUT_DIR
      },
      module: {
        loaders: [{ test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }]
      },
      plugins: [
        new ExtractTextPlugin('style.css'),
        new HtmlWebpackPlugin({
          inlineSource: '.(js|css)$'
        }),
        new HtmlWebpackInlineSourcePlugin()
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      var htmlFile = path.resolve(__dirname, '../dist/index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        var $ = cheerio.load(data);
        expect($('script').html()).toContain('.embedded.source');
        expect($('style').html()).toContain('.embedded.source');
        done();
      });
    });
  });
});
