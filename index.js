'use strict';
var escapeRegex = require('escape-string-regexp');
var path = require('path');
var slash = require('slash');
var sourceMapUrl = require('source-map-url');

function HtmlWebpackInlineSourcePlugin (htmlWebpackPlugin) {
  this.htmlWebpackPlugin = htmlWebpackPlugin;
}

HtmlWebpackInlineSourcePlugin.prototype.apply = function (compiler) {
  var self = this;

  // Hook into the html-webpack-plugin processing
  compiler.hooks.compilation.tap('html-webpack-inline-source-plugin', compilation => {
    self.htmlWebpackPlugin
      .getHooks(compilation)
      .alterAssetTagGroups.tapAsync('html-webpack-inline-source-plugin', (htmlPluginData, callback) => {
        if (!htmlPluginData.plugin.options.inlineSource) {
          return callback(null, htmlPluginData);
        }

        var regexStr = htmlPluginData.plugin.options.inlineSource;

        var result = self.processTags(compilation, regexStr, htmlPluginData);

        callback(null, result);
      });
  });
};

HtmlWebpackInlineSourcePlugin.prototype.processTags = function (compilation, regexStr, pluginData) {
  var self = this;

  var bodyTags = [];
  var headTags = [];

  var regex = new RegExp(regexStr);
  var filename = pluginData.plugin.options.filename;

  pluginData.headTags.forEach(function (tag) {
    headTags.push(self.processTag(compilation, regex, tag, filename));
  });

  pluginData.bodyTags.forEach(function (tag) {
    bodyTags.push(self.processTag(compilation, regex, tag, filename));
  });

  return { headTags: headTags, bodyTags: bodyTags, plugin: pluginData.plugin, outputName: pluginData.outputName };
};

HtmlWebpackInlineSourcePlugin.prototype.resolveSourceMaps = function (compilation, assetName, asset) {
  var source = asset.source();
  var out = compilation.outputOptions;
  // Get asset file absolute path
  var assetPath = path.join(out.path, assetName);
  // Extract original sourcemap URL from source string
  if (typeof source !== 'string') {
    source = source.toString();
  }
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

HtmlWebpackInlineSourcePlugin.prototype.processTag = function (compilation, regex, tag, filename) {
  var assetUrl;

  // inline js
  if (tag.tagName === 'script' && tag.attributes && regex.test(tag.attributes.src)) {
    assetUrl = tag.attributes.src;
    tag = {
      tagName: 'script',
      closeTag: true,
      attributes: {
        type: 'text/javascript'
      }
    };

  // inline css
  } else if (tag.tagName === 'link' && regex.test(tag.attributes.href)) {
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
    // Strip public URL prefix from asset URL to get Webpack asset name
    var publicUrlPrefix = compilation.outputOptions.publicPath || '';
    // if filename is in subfolder, assetUrl should be prepended folder path
    if (path.basename(filename) !== filename) {
      assetUrl = path.dirname(filename) + '/' + assetUrl;
    }
    var assetName = path.posix.relative(publicUrlPrefix, assetUrl);
    var asset = getAssetByName(compilation.assets, assetName);
    var updatedSource = this.resolveSourceMaps(compilation, assetName, asset);
    tag.innerHTML = (tag.tagName === 'script') ? updatedSource.replace(/(<)(\/script>)/g, '\\x3C$2') : updatedSource;
  }

  return tag;
};

function getAssetByName (assests, assetName) {
  for (var key in assests) {
    if (assests.hasOwnProperty(key)) {
      var processedKey = path.posix.relative('', key);
      if (processedKey === assetName) {
        return assests[key];
      }
    }
  }
}

module.exports = HtmlWebpackInlineSourcePlugin;
