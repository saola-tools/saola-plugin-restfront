"use strict";

const { portletifyConfig } = require("app-webserver").require("portlet");

function Service (params = {}) {
  const { sandboxConfig } = params;
  //
  const pluginConfig = portletifyConfig(sandboxConfig);
  //
  this.getPluginConfig = function() {
    return pluginConfig;
  };
}

Service.referenceHash = {};

module.exports = Service;
