'use strict';
var assert = require('assert');

function HtmlWebpackInlineSourcePlugin (options) {
  assert.equal(options, undefined, 'The HtmlWebpackInlineSourcePlugin does not accept any options');
}

HtmlWebpackInlineSourcePlugin.prototype.apply = function (compiler) {
  var self = this;

  // Hook into the html-webpack-plugin processing
  compiler.plugin('compilation', function (compilation) {
    compilation.plugin('html-webpack-plugin-alter-asset-tags', function (htmlPluginData, callback) {
      // Skip if the plugin configuration didn't set `inlineSource`
      if (!htmlPluginData.plugin.options.inlineSource) {
        return callback(null);
      }

      var regexStr = htmlPluginData.plugin.options.inlineSource;

      var result = self.processTags(compilation, regexStr, htmlPluginData);

      callback(null, result);
    });
  });
};

HtmlWebpackInlineSourcePlugin.prototype.processTags = function (compilation, regexStr, pluginData) {
  var self = this;

  var body = [];
  var head = [];

  var regex = new RegExp(regexStr);

  pluginData.head.forEach(function (tag) {
    head.push(self.processTag(compilation, regex, tag));
  });

  pluginData.body.forEach(function (tag) {
    body.push(self.processTag(compilation, regex, tag));
  });

  return { head: head, body: body };
};

HtmlWebpackInlineSourcePlugin.prototype.processTag = function (compilation, regex, tag) {
  var assetPath;

  // inline js
  if (tag.tagName === 'script' && regex.test(tag.attributes.src)) {
    assetPath = tag.attributes.src;
    tag = {
      tagName: 'script',
      closeTag: true,
      attributes: {
        type: 'text/javascript'
      }
    };

  // inline css
  } else if (tag.tagName === 'link' && regex.test(tag.attributes.href)) {
    assetPath = tag.attributes.href;
    tag = {
      tagName: 'style',
      closeTag: true,
      attributes: {
        type: 'text/css'
      }
    };
  }

  if (assetPath) {
    var asset = compilation.assets[assetPath.split('/').pop()];

    // Look up full path if partial path not found
    if (!asset) {
      asset = compilation.assets[assetPath];
    }

    tag.innerHTML = asset.source();
  }

  return tag;
};

module.exports = HtmlWebpackInlineSourcePlugin;
