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
        rules: [{ test: /\.css$/, use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        }) }]
      },
      plugins: [
        new ExtractTextPlugin('style.css'),
        new HtmlWebpackPlugin(),
        new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin)
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      var htmlFile = path.resolve(OUTPUT_DIR, 'index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        var $ = cheerio.load(data);
        expect($('script[src="bundle.js"]').html()).toBeNull();
        expect($('link[href="style.css"]').html()).toBe('');
        done();
      });
    });
  });

  it('should embed sources inline when regex matches file names', function (done) {
    webpack({
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        // filename with directory tests sourcemap URL correction
        filename: 'bin/app.js',
        // public path required to test sourcemap URL correction, but also for this bug work-around:
        // https://github.com/webpack/webpack/issues/3242#issuecomment-260411104
        publicPath: '/assets',
        path: OUTPUT_DIR
      },
      module: {
        rules: [{ test: /\.css$/, use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        }) }]
      },
      // generate sourcemaps for testing URL correction
      devtool: '#source-map',
      plugins: [
        new ExtractTextPlugin('style.css'),
        new HtmlWebpackPlugin({
          inlineSource: '.(js|css)$'
        }),
        new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin)
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      var htmlFile = path.resolve(OUTPUT_DIR, 'index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        var $ = cheerio.load(data);
        expect($('script').html()).toContain('.embedded.source');
        expect($('script').html()).toContain('//# sourceMappingURL=/assets/bin/app.js.map');
        expect($('style').html()).toContain('.embedded.source');
        expect($('style').html()).toContain('/*# sourceMappingURL=/assets/style.css.map');
        done();
      });
    });
  });

  it('should embed sources inline even if a query string hash is used', function (done) {
    webpack({
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        // filename with output hash
        filename: 'app.js?[hash]',
        path: OUTPUT_DIR
      },
      module: {
        rules: [{ test: /\.css$/, use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        }) }]
      },
      plugins: [
        new ExtractTextPlugin('style.css?[hash]'),
        new HtmlWebpackPlugin({
          // modified regex to accept query string
          inlineSource: '.(js|css)(\\?.*)?$'
        }),
        new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin)
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      var htmlFile = path.resolve(OUTPUT_DIR, 'index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        var $ = cheerio.load(data);
        expect($('script').html()).toContain('.embedded.source');
        expect($('style').html()).toContain('.embedded.source');
        done();
      });
    });
  });

  it('should embed source and not error if public path is undefined', function (done) {
    webpack({
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        filename: 'bin/app.js',
        path: OUTPUT_DIR
      },
      module: {
        rules: [{ test: /\.css$/, use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        }) }]
      },
      plugins: [
        new ExtractTextPlugin('style.css'),
        new HtmlWebpackPlugin({
          inlineSource: '.(js|css)$'
        }),
        new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin)
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      var htmlFile = path.resolve(OUTPUT_DIR, 'index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        var $ = cheerio.load(data);
        expect($('script').html()).toContain('.embedded.source');
        expect($('style').html()).toContain('.embedded.source');
        done();
      });
    });
  });

  it('should embed source and not error if html in subfolder', function (done) {
    webpack({
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        filename: 'bin/app.js',
        path: OUTPUT_DIR
      },
      module: {
        rules: [{ test: /\.css$/, use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        }) }]
      },
      plugins: [
        new ExtractTextPlugin('style.css'),
        new HtmlWebpackPlugin({
          filename: 'subfolder/index.html',
          inlineSource: '.(js|css)$'
        }),
        new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin)
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      var htmlFile = path.resolve(OUTPUT_DIR, 'subfolder/index.html');
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
