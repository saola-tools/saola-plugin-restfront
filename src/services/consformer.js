"use strict";

const { portletifyConfig } = require("app-webserver").require("portlet");

function Consformer (params = {}) {
  const { sandboxConfig } = params;
  //
  const pluginConfig = portletifyConfig(sandboxConfig);
  //
  this.getPluginConfig = function() {
    return pluginConfig;
  }
}

Consformer.referenceHash = {};

module.exports = Consformer;
