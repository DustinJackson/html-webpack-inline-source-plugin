import { Plugin } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export = HtmlWebpackInlineSourcePlugin;
declare class HtmlWebpackInlineSourcePlugin extends Plugin {
  constructor(htmlWebpackPlugin: HtmlWebpackPlugin)
}
declare namespace HtmlWebpackInlineSourcePlugin { }
