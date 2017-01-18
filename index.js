'use strict';
var assert = require('assert');
var escapeRegex = require('escape-string-regexp');
var path = require('path');
var slash = require('slash');
var sourceMapUrl = require('source-map-url');

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

      var regexStr = htmlPluginData.plugin.options.inlineSource,
          inject = htmlPluginData.plugin.options.inlineInject,
          result = self.processTags(compilation, regexStr, inject, htmlPluginData);

      callback(null, result);
    });
  });
};

HtmlWebpackInlineSourcePlugin.prototype.processTags = function (compilation, regexStr, inject, pluginData) {
  var self = this;

  var body = [];
  var head = [];

  var regex = new RegExp(regexStr);

  pluginData.head.forEach(function (tag) {
    if (inject === 'body' && self.tagRegexMatch(tag, regex)) {
      body.push(self.processTag(compilation, regex, tag));
    } else {
      head.push(self.processTag(compilation, regex, tag));
    }
  });

  pluginData.body.forEach(function (tag) {
    if (inject === 'head' && self.tagRegexMatch(tag, regex)) {
      head.push(self.processTag(compilation, regex, tag));
    } else {
      body.push(self.processTag(compilation, regex, tag));
    }
  });

  return { head: head, body: body };
};

HtmlWebpackInlineSourcePlugin.prototype.resolveSourceMaps = function (compilation, assetName, asset) {
  var source = asset.source();
  var out = compilation.outputOptions;
  // Get asset file absolute path
  var assetPath = path.join(out.path, assetName);
  // Extract original sourcemap URL from source string
  var mapUrlOriginal = sourceMapUrl.getFrom(source);
  // Return unmodified source if map is unspecified, URL-encoded, or already relative to site root
  if (!mapUrlOriginal || mapUrlOriginal.indexOf('data:') === 0 || mapUrlOriginal.indexOf('/') === 0) {
    return source;
  }
  // Figure out sourcemap file path *relative to the asset file path*
  var assetDir = path.dirname(assetPath);
  var mapPath = path.join(assetDir, mapUrlOriginal);
  var mapPathRelative = path.relative(out.path, mapPath);
  // Starting with Node 6, `path` module throws on `undefined`
  var publicPath = out.publicPath || '';
  // Prepend Webpack public URL path to source map relative path
  // Calling `slash` converts Windows backslashes to forward slashes
  var mapUrlCorrected = slash(path.join(publicPath, mapPathRelative));
  // Regex: exact original sourcemap URL, possibly '*/' (for CSS), then EOF, ignoring whitespace
  var regex = new RegExp(escapeRegex(mapUrlOriginal) + '(\\s*(?:\\*/)?\\s*$)');
  // Replace sourcemap URL and (if necessary) preserve closing '*/' and whitespace
  return source.replace(regex, function (match, group) {
    return mapUrlCorrected + group;
  });
};

HtmlWebpackInlineSourcePlugin.prototype.tagRegexMatch = function (tag, regex) {
  return this.scriptTagRegexMatch(tag, regex) || this.linkTagRegexMatch(tag, regex);
}

HtmlWebpackInlineSourcePlugin.prototype.linkTagRegexMatch = function (tag, regex) {
  return (tag.tagName === 'link' && regex.test(tag.attributes.href));
}

HtmlWebpackInlineSourcePlugin.prototype.scriptTagRegexMatch = function (tag, regex) {
  return (tag.tagName === 'script' && regex.test(tag.attributes.src));
}

HtmlWebpackInlineSourcePlugin.prototype.processTag = function (compilation, regex, tag) {
  var assetUrl;

  // inline js
  if (this.scriptTagRegexMatch(tag, regex)) {
    assetUrl = tag.attributes.src;
    tag = {
      tagName: 'script',
      closeTag: true,
      attributes: {
        type: 'text/javascript'
      }
    };

  // inline css
  } else if (this.linkTagRegexMatch(tag, regex)) {
    assetUrl = tag.attributes.href;
    tag = {
      tagName: 'style',
      closeTag: true,
      attributes: {
        type: 'text/css'
      }
    };
  }

  if (assetUrl) {
    // Strip query string (e.g. cache busting hash) from asset URL
    assetUrl = assetUrl.replace(/\?.*$/, '');
    // Strip public URL prefix from asset URL to get Webpack asset name
    var publicUrlPrefix = compilation.outputOptions.publicPath || '';
    var assetName = path.posix.relative(publicUrlPrefix, assetUrl);
    var asset = compilation.assets[assetName];
    var updatedSource = this.resolveSourceMaps(compilation, assetName, asset);
    tag.innerHTML = updatedSource;
  }

  return tag;
};

module.exports = HtmlWebpackInlineSourcePlugin;