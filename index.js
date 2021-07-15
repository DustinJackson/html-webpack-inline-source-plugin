'use strict';
const assert = require('assert');
const escapeRegex = require('escape-string-regexp');
const path = require('path');
const slash = require('slash');
const sourceMapUrl = require('source-map-url');

let htmlWebpackPlugin = null;
try {
  htmlWebpackPlugin = require('html-webpack-plugin');
} catch (_err) {}

function HtmlWebpackInlineSourcePlugin (htmlWebpackPluginOption) {
  this.htmlWebpackPlugin = htmlWebpackPluginOption || htmlWebpackPlugin;
  assert(!!this.htmlWebpackPlugin, 'html-webpack-inline-source-plugin requires html-webpack-plugin as a peer dependency. Please install html-webpack-plugin');
}

HtmlWebpackInlineSourcePlugin.prototype.apply = function (compiler) {
  const self = this;

  // Hook into the html-webpack-plugin processing
  compiler.hooks.compilation.tap('html-webpack-inline-source-plugin', function (compilation) {
    const hooks = self.htmlWebpackPlugin.getHooks(compilation);

    hooks.alterAssetTags.tap('html-webpack-inline-source-plugin', function (htmlPluginData) {
      if (!htmlPluginData.plugin.options.inlineSource) return htmlPluginData;
      const regexStr = htmlPluginData.plugin.options.inlineSource;
      return self.processTags(compilation, regexStr, htmlPluginData);
    });
  });
};

HtmlWebpackInlineSourcePlugin.prototype.processTags = function (compilation, regexStr, pluginData) {
  const self = this;
  const regex = new RegExp(regexStr);
  const filename = pluginData.plugin.options.filename;

  const meta = pluginData.assetTags.meta.map(function (tag) { return self.processTag(compilation, regex, tag, filename); });
  const scripts = pluginData.assetTags.scripts.map(function (tag) { return self.processTag(compilation, regex, tag, filename); });
  const styles = pluginData.assetTags.styles.map(function (tag) { return self.processTag(compilation, regex, tag, filename); });

  const result = { ...pluginData };
  result.assetTags = { meta, scripts, styles };
  return result;
};

HtmlWebpackInlineSourcePlugin.prototype.resolveSourceMaps = function (compilation, assetName, asset) {
  let source = asset.source();
  const out = compilation.outputOptions;
  // Get asset file absolute path
  const assetPath = path.join(out.path, assetName);
  // Extract original sourcemap URL from source string
  if (typeof source !== 'string') source = source.toString();

  const mapUrlOriginal = sourceMapUrl.getFrom(source);
  // Return unmodified source if map is unspecified, URL-encoded, or already relative to site root
  if (!mapUrlOriginal || mapUrlOriginal.indexOf('data:') === 0 || mapUrlOriginal.indexOf('/') === 0) {
    return source;
  }
  // Figure out sourcemap file path *relative to the asset file path*
  const assetDir = path.dirname(assetPath);
  const mapPath = path.join(assetDir, mapUrlOriginal);
  const mapPathRelative = path.relative(out.path, mapPath);
  // Starting with Node 6, `path` module throws on `undefined`
  let publicPath = out.publicPath || '';
  if (publicPath === 'auto') publicPath = '';

  // Prepend Webpack public URL path to source map relative path
  // Calling `slash` converts Windows backslashes to forward slashes
  const mapUrlCorrected = slash(path.join(publicPath, mapPathRelative));
  // Regex: exact original sourcemap URL, possibly '*/' (for CSS), then EOF, ignoring whitespace
  const regex = new RegExp(escapeRegex(mapUrlOriginal) + '(\\s*(?:\\*/)?\\s*$)');
  // Replace sourcemap URL and (if necessary) preserve closing '*/' and whitespace
  return source.replace(regex, function (match, group) {
    return mapUrlCorrected + group;
  });
};

HtmlWebpackInlineSourcePlugin.prototype.processTag = function (compilation, regex, tag, filename) {
  let assetUrl;

  // inline js
  if (tag.tagName === 'script' && regex.test(tag.attributes.src)) assetUrl = tag.attributes.src;
  // inline css
  else if (tag.tagName === 'link' && regex.test(tag.attributes.href)) assetUrl = tag.attributes.href;
  // not inline
  else return tag;

  // Strip public URL prefix from asset URL to get Webpack asset name
  let publicPath = compilation.outputOptions.publicPath || '';
  if (publicPath === 'auto') publicPath = '';
  else if (publicPath && !publicPath.endsWith('/')) publicPath += '/';

  // if filename is in subfolder, assetUrl should be prepended folder path
  if (path.basename(filename) !== filename) assetUrl = path.dirname(filename) + '/' + assetUrl;

  const assetName = path.posix.relative(publicPath, assetUrl);
  let asset = compilation.assets[assetName];
  if (!asset) asset = getAssetByName(compilation.assets, assetName, publicPath);
  if (!asset) return tag; // TODO: handle not found
  const updatedSource = this.resolveSourceMaps(compilation, assetName, asset);

  return {
    tagName: tag.tagName === 'script' ? 'script' : 'style',
    closeTag: true,
    attributes: { type: tag.tagName === 'script' ? 'text/javascript' : 'text/css' },
    innerHTML: tag.tagName === 'script' ? updatedSource.replace(/(<)(\/script>)/g, '\\x3C$2') : updatedSource,
    meta: { plugin: 'html-webpack-inline-source-plugin' }
  };
};

function getAssetByName (assests, assetName, publicPath) {
  for (const key in assests) {
    if (Object.prototype.hasOwnProperty.call(assests, key)) {
      const processedKey = path.posix.relative(publicPath, key);
      if (processedKey === assetName) return assests[key];
    }
  }
}

module.exports = HtmlWebpackInlineSourcePlugin;
