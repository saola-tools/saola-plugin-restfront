"use strict";

const Service = function(params = {}) {
  this.calculateTriangleArea = function (data) {
    const { base, height } = data || {};
    return { area: (base * height) / 2 };
  };
};

module.exports = Service;
