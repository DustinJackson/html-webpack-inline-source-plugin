/* eslint-env jasmine */
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const webpack = require('webpack');
const rimraf = require('rimraf');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('../');

const OUTPUT_DIR = path.join(__dirname, '../dist');

describe('HtmlWebpackInlineSourcePlugin', function () {
  beforeEach(function (done) {
    rimraf(OUTPUT_DIR, done);
  });

  it('should not inline source by default', function (done) {
    webpack({
      mode: 'development',
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        path: OUTPUT_DIR
      },
      module: {
        rules: [{ test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }]
      },
      plugins: [
        new MiniCssExtractPlugin({ filename: 'style.css' }),
        new HtmlWebpackPlugin(),
        new HtmlWebpackInlineSourcePlugin()
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      const htmlFile = path.resolve(OUTPUT_DIR, 'index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        const $ = cheerio.load(data);
        expect($('script[src="main.js"]').html()).toBe('');
        expect($('link[href="style.css"]').html()).toBe('');
        done();
      });
    });
  });

  it('should embed sources inline when regex matches file names', function (done) {
    webpack({
      mode: 'development',
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
        rules: [{ test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }]
      },
      // generate sourcemaps for testing URL correction
      devtool: 'cheap-module-source-map',
      plugins: [
        new MiniCssExtractPlugin({ filename: 'style.css' }),
        new HtmlWebpackPlugin({
          inlineSource: '.(js|css)$'
        }),
        new HtmlWebpackInlineSourcePlugin()
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      const htmlFile = path.resolve(OUTPUT_DIR, 'index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        const $ = cheerio.load(data);
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
      mode: 'development',
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        // filename with output hash
        filename: 'app.js?[fullhash]',
        path: OUTPUT_DIR
      },
      module: {
        rules: [{ test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }]
      },
      plugins: [
        new MiniCssExtractPlugin({ filename: 'style.css?[fullhash]' }),
        new HtmlWebpackPlugin({
          // modified regex to accept query string
          inlineSource: '.(js|css)(\\?.*)?$'
        }),
        new HtmlWebpackInlineSourcePlugin()
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      const htmlFile = path.resolve(OUTPUT_DIR, 'index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        const $ = cheerio.load(data);
        expect($('script').html()).toContain('.embedded.source');
        expect($('style').html()).toContain('.embedded.source');
        done();
      });
    });
  });

  it('should embed source and not error if public path is undefined', function (done) {
    webpack({
      mode: 'development',
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        filename: 'bin/app.js',
        path: OUTPUT_DIR
      },
      module: {
        rules: [{ test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }]
      },
      plugins: [
        new MiniCssExtractPlugin({ filename: 'style.css' }),
        new HtmlWebpackPlugin({
          inlineSource: '.(js|css)$'
        }),
        new HtmlWebpackInlineSourcePlugin()
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      const htmlFile = path.resolve(OUTPUT_DIR, 'index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        const $ = cheerio.load(data);
        expect($('script').html()).toContain('.embedded.source');
        expect($('style').html()).toContain('.embedded.source');
        done();
      });
    });
  });

  it('should embed source and not error if html in subfolder', function (done) {
    webpack({
      mode: 'development',
      entry: path.join(__dirname, 'fixtures', 'entry.js'),
      output: {
        filename: 'bin/app.js',
        path: OUTPUT_DIR
      },
      module: {
        rules: [{ test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }]
      },
      plugins: [
        new MiniCssExtractPlugin({ filename: 'style.css' }),
        new HtmlWebpackPlugin({
          filename: 'subfolder/index.html',
          inlineSource: '.(js|css)$'
        }),
        new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin)
      ]
    }, function (err) {
      expect(err).toBeFalsy();
      const htmlFile = path.resolve(OUTPUT_DIR, 'subfolder/index.html');
      fs.readFile(htmlFile, 'utf8', function (er, data) {
        expect(er).toBeFalsy();
        const $ = cheerio.load(data);
        expect($('script').html()).toContain('.embedded.source');
        expect($('style').html()).toContain('.embedded.source');
        done();
      });
    });
  });
});
