"use strict";

const Devebot = require("devebot");
const lodash = Devebot.require("lodash");
const chores = Devebot.require("chores");
const path = require("path");

const portlet = require("app-webserver").require("portlet");
const { PORTLETS_COLLECTION_NAME, PortletMixiner } = portlet;

function Service (params = {}) {
  const { packageName, loggingFactory, configPortletifier, restfrontHandler, webweaverService } = params;
  const express = webweaverService.express;

  const pluginConfig = configPortletifier.getPluginConfig();

  PortletMixiner.call(this, {
    portletDescriptors: lodash.get(pluginConfig, PORTLETS_COLLECTION_NAME),
    portletReferenceHolders: { restfrontHandler, webweaverService },
    portletArguments: { packageName, loggingFactory, express },
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

Service.referenceHash = {
  configPortletifier: "portletifier",
  restfrontHandler: "handler",
  webweaverService: "app-webweaver/webweaverService"
};

function Portlet (params = {}) {
  const { portletName, portletConfig } = params;
  const { packageName, loggingFactory, express, restfrontHandler, webweaverService } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName || "app-restfront");

  L && L.has("silly") && L.log("silly", T && T.add({ portletName }).toMessage({
    tags: [ blockRef ],
    text: "The Portlet[${portletName}] is available"
  }));

  const contextPath = portletConfig.contextPath || "/restfront";
  const apiPath = portletConfig.apiPath || "";
  const apiFullPath = path.join(contextPath, apiPath);
  const staticpages = portletConfig.static;

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
      middleware: restfrontHandler.validator(express)
    };
  };

  this.getRestLayer = function() {
    return {
      name: "app-restfront-handler-restapi",
      path: apiFullPath,
      middleware: restfrontHandler.buildRestRouter(express)
    };
  };

  if (portletConfig.autowired !== false) {
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
    layerware.push(webweaverService.getSessionLayer([
      webweaverService.getJsonBodyParserLayer(),
      webweaverService.getUrlencodedBodyParserLayer(),
      this.getValidator(),
      this.getRestLayer()
    ], apiFullPath));
    //
    layerware.push(webweaverService.getDefaultRedirectLayer(["/$", contextPath + "$"]));
    //
    webweaverService.push(layerware, portletConfig.priority);
  }
}

module.exports = Service;
