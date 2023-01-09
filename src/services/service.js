"use strict";

const Devebot = require("devebot");
const lodash = Devebot.require("lodash");
const path = require("path");

const { PortletMixiner } = require("app-webserver").require("portlet");

function Service (params = {}) {
  const { configPortletifier, restfrontHandler, webweaverService } = params;

  const pluginConfig = configPortletifier.getPluginConfig();

  PortletMixiner.call(this, {
    pluginConfig,
    portletForwarder: webweaverService,
    portletArguments: { L, T, restfrontHandler, webweaverService },
    PortletConstructor: Portlet,
  });

  // @deprecated
  this.getAssetsLayer = function (webpath, filepath, index) {
    return this.hasPortlet() && this.getPortlet().getAssetsLayer(webpath, filepath, index) || undefined;
  };

  // @deprecated
  this.getValidator = function (express) {
    return this.hasPortlet() && this.getPortlet().getValidator() || undefined;
  };

  // @deprecated
  this.getRestLayer = function (express) {
    return this.hasPortlet() && this.getPortlet().getRestLayer() || undefined;
  };
}

Object.assign(Service.prototype, PortletMixiner.prototype);

function Portlet (params = {}) {
  const { portletName, portletConfig } = params;
  const { restfrontHandler, webweaverService } = params;

  const contextPath = portletConfig.contextPath || "/restfront";
  const apiPath = portletConfig.apiPath || "";
  const apiFullPath = path.join(contextPath, apiPath);
  const staticpages = portletConfig.static;
  const express = webweaverService.express;

  this.getAssetsLayer = function(webpath, filepath, index) {
    return {
      name: "app-restfront-service-assets~" + index,
      path: path.join(contextPath, webpath),
      middleware: express.static(filepath)
    };
  };

  this.getValidator = function() {
    return {
      name: "app-restfront-handler-validator",
      path: apiFullPath,
      middleware: restfrontHandler.getPortlet(portletName).validator(express)
    };
  };

  this.getRestLayer = function() {
    return {
      name: "app-restfront-handler-restapi",
      path: apiFullPath,
      middleware: restfrontHandler.getPortlet(portletName).buildRestRouter(express)
    };
  };

  if (portletConfig.autowired !== false && webweaverService.hasPortlet(portletName)) {
    const webweaverPortlet = webweaverService.getPortlet(portletName);
    const self = this;
    const layerware = [];
    lodash.keys(staticpages).forEach(function(webpath, index) {
      if (lodash.isString(webpath)) {
        const filepath = staticpages[webpath];
        if (lodash.isString(filepath)) {
          layerware.push(self.getAssetsLayer(webpath, filepath, index));
        }
      }
    });
    //
    layerware.push(webweaverPortlet.getSessionLayer([
      webweaverPortlet.getJsonBodyParserLayer(),
      webweaverPortlet.getUrlencodedBodyParserLayer(),
      this.getValidator(),
      this.getRestLayer()
    ], apiFullPath));
    //
    layerware.push(webweaverPortlet.getDefaultRedirectLayer(["/$", contextPath + "$"]));
    //
    webweaverPortlet.push(layerware, portletConfig.priority);
  }
}

Service.referenceHash = {
  configPortletifier: "consformer",
  restfrontHandler: "handler",
  webweaverService: "app-webweaver/webweaverService"
};

module.exports = Service;
