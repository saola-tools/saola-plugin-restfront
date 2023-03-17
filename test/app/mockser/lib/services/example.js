"use strict";

const http = require("http");

const Core = require("@saola/core");
const lodash = Core.require("lodash");
const express = require("express");

function Service (params = {}) {
  const { loggingFactory, sandboxConfig, profileConfig, webserverTrigger } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  L.has("silly") && L.log("silly", "configuration: %s", T.toMessage({
    text: JSON.stringify(sandboxConfig)
  }));

  if (sandboxConfig.enabled !== false) {
    const app = express();

    app.get("/example/:action", function(req, res) {
      res.set("Content-Type", "application/json");
      res.status(200).send(JSON.stringify({
        action: req.params.action,
        port: webserverTrigger.getPort(),
        host: webserverTrigger.getHost(),
        request: {
          headers: req.headers
        }
      }, null, 2));
    });

    app.put("/example/simulate/:statusCode", function(req, res) {
      const statusCode = req.params.statusCode;
      if (statusCode in http.STATUS_CODES && statusCode.match(/^(4|5)\d\d$/)) {
        res.status(parseInt(statusCode)).send(http.STATUS_CODES[statusCode]);
        return;
      }
      // res.set("Content-Type", "application/json");
      res.status(500).send("Unknown Error");
    });

    webserverTrigger.attach(app);
  }
}

Service.referenceHash = {
  webserverTrigger: "webserverTrigger"
};

module.exports = Service;
