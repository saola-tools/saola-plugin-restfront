"use strict";

module.exports = {
  methods: {
    invokeHttps: {
      method: "GET",
      url: "http://localhost:8989/example/stats",
      arguments: {
        transform: function() {
          return {
            headers: {}
          };
        }
      },
    },
  }
};
