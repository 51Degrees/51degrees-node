/*
 * Loads the 51Degrees script with this page's Resource Key and shows the
 * Human Confidence value the cloud service returns for this visit.
 */
(function () {
  "use strict";

  // This page's own Resource Key. It is public by design and the cloud
  // service accepts it only from pages on 51degrees.github.io.
  var RESOURCE_KEY = "AQRVdgJ-G-c-BHBG30g";

  var CLOUD = "https://cloud.51degrees.com/api/v4/";

  // The meanings published in the Human Confidence documentation.
  var MEANINGS = {
    High: "High confidence that a person is reading the page.",
    Medium: "Mixed signals. Could be a person, could be a script.",
    Low: "Almost certainly no person is reading it.",
    Unknown: "Not measured, usually because the script didn't run."
  };

  function show(value, meaning) {
    var big = document.getElementById("value");
    big.textContent = value || " ";
    big.className = "big" + (MEANINGS[value] ? " " + value : "");
    document.getElementById("meaning").textContent = meaning || "";
  }

  function showResult(data) {
    var value = (data && data.derived && data.derived.humanconfidence) ||
      "Unknown";
    show(value, MEANINGS[value] || "");
  }

  show("…", "Waiting for the 51Degrees script.");
  var script = document.createElement("script");
  script.src = CLOUD + RESOURCE_KEY + ".js";
  script.onload = function () {
    if (typeof fod === "undefined") {
      show("", "The 51Degrees script didn't start. Try reloading the page.");
      return;
    }
    fod.complete(showResult);
  };
  script.onerror = function () {
    show("", "The 51Degrees script didn't load. Try reloading the page.");
  };
  document.head.appendChild(script);
})();
