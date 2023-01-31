"use strict";

const path = require("path");

const app = require("@saola/core").launchApplication({
  appRootPath: __dirname
}, [
  {
    name: "@saola/plugin-restfront",
    path: path.join(__dirname, "../../../index.js")
  },
]);

if (require.main === module) app.server.start();

module.exports = app;
