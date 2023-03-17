"use strict";

const main = require("./index");

const resolver = main.runner.getSandboxService("@saola/plugin-restfetch/resolver");

const mockser = resolver.lookupService("restfetch-example/mockser");

mockser.invokeHttps().then(function(output) {
  console.log(JSON.stringify(output, null, 2));
});
