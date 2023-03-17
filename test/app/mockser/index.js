"use strict";

const app = require("@saola/core").launchApplication({
  appRootPath: __dirname
}, [
  "@saola/plugin-webserver"
]);

if (require.main === module) {
  app.server.start();
}

module.exports = app;
