"use strict";

const Devebot = require("@saola/core");
const lodash = Devebot.require("lodash");
const chores = Devebot.require("chores");
const path = require("path");

const { PortletMixiner } = require("@saola/plugin-webserver").require("portlet");

function Service (params = {}) {
  const { packageName, loggingFactory, sandboxOrigin, configPortletifier, restfrontHandler, webweaverService } = params;
  const express = webweaverService.express;

  PortletMixiner.call(this, {
    portletBaseConfig: sandboxOrigin,
    portletDescriptors: configPortletifier.getPortletDescriptors(),
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
  webweaverService: "@saola/plugin-webweaver/webweaverService"
};

function Portlet (params = {}) {
  const { portletName, portletConfig } = params;
  const { packageName, loggingFactory, express, restfrontHandler, webweaverService } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  const contextPath = portletConfig.contextPath || "/restfront";
  const apiPath = portletConfig.apiPath || "";
  const apiFullPath = path.join(contextPath, apiPath);
  const staticpages = portletConfig.static;

  L && L.has("silly") && L.log("silly", T && T.add({ blockRef, portletName, apiFullPath }).toMessage({
    tags: [ blockRef ],
    text: "The Portlet[${blockRef}][${portletName}] is available for: '${apiFullPath}'"
  }));

  this.getAssetsLayer = function(webpath, filepath, index) {
    return {
      name: "saola-plugin-restfront-service-assets~" + index,
      path: path.join(contextPath, webpath),
      middleware: express.static(filepath)
    };
  };

  this.getValidator = function() {
    return {
      name: "saola-plugin-restfront-handler-validator",
      path: apiFullPath,
      middleware: restfrontHandler.validator(express)
    };
  };

  this.getRestLayer = function() {
    return {
      name: "saola-plugin-restfront-handler-restapi",
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
