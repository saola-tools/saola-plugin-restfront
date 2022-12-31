"use strict";

const Devebot = require("devebot");
const chores = Devebot.require("chores");

const app = require("../app/simplest");

describe("app.server", function() {
  before(function() {
    chores.setEnvironments({
      DEVEBOT_FORCING_SILENT: "devebot,webserver",
      LOGOLITE_FULL_LOG_MODE: "false",
      LOGOLITE_ALWAYS_ENABLED: "all",
      LOGOLITE_ALWAYS_MUTED: "all"
    });
  });
  //
  after(function() {
    chores.clearCache();
  });
  //
  it("app.server should be started/stopped properly", function(done) {
    app.server.start().then(function() {
      return app.server.stop();
    }).then(function() {
      done();
    });
  });
});
