"use strict";

const Core = require("@saola/core");
const lodash = Core.require("lodash");
const chores = Core.require("chores");
const path = require("path");

const { PortletMixiner } = Core.require("portlet");

function Service (params = {}) {
  const { packageName, loggingFactory, configPortletifier } = params;
  const { restfrontHandler, restfrontSupporter, webweaverService } = params;
  const express = webweaverService.express;

  PortletMixiner.call(this, {
    portletBaseConfig: configPortletifier.getPortletBaseConfig(),
    portletDescriptors: configPortletifier.getPortletDescriptors(),
    portletReferenceHolders: { restfrontHandler, restfrontSupporter, webweaverService },
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
  restfrontSupporter: "supporter",
  webweaverService: "@saola/plugin-webweaver/webweaverService"
};

function Portlet (params = {}) {
  const { portletName, portletConfig } = params;
  const { packageName, loggingFactory, express } = params;
  const { restfrontHandler, restfrontSupporter, webweaverService } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  const contextPath = portletConfig.contextPath || "/restfront";

  L && L.has("silly") && L.log("silly", T && T.add({ blockRef, portletName, contextPath }).toMessage({
    tags: [ blockRef ],
    text: "The Portlet[${blockRef}][${portletName}] is available for: '${contextPath}'"
  }));

  this.getAssetsLayer = function(webpath, filepath, index) {
    return {
      name: "saola-plugin-restfront-service-assets~" + index,
      path: path.join(contextPath, webpath),
      middleware: express.static(filepath)
    };
  };

  if (portletConfig.autowired !== false) {
    const self = this;
    const layerware = [];
    const staticpages = portletConfig.static;
    lodash.keys(staticpages).forEach(function(webpath, index) {
      if (lodash.isString(webpath)) {
        const filepath = lodash.get(staticpages, webpath);
        if (lodash.isString(filepath)) {
          layerware.push(self.getAssetsLayer(webpath, filepath, index));
        }
      }
    });
    //
    layerware.push(webweaverService.getSessionLayer([
      webweaverService.getJsonBodyParserLayer(),
      webweaverService.getUrlencodedBodyParserLayer(),
      restfrontHandler.getValidator(express),
      restfrontHandler.getRestLayer(express),
      restfrontSupporter.getMiddleware(express),
    ]));
    //
    layerware.push(webweaverService.getDefaultRedirectLayer(["/$", contextPath + "$"]));
    //
    webweaverService.push(layerware, portletConfig.priority);
  }
}

module.exports = Service;
