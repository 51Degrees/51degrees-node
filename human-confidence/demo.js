/*
 * Loads the 51Degrees script with a Resource Key and shows the Human
 * Confidence value the cloud service returns for this visit.
 */
(function () {
  "use strict";

  // The Resource Key the page uses when it opens. A visitor can use their
  // own key with the form instead.
  var RESOURCE_KEY = "";

  var CLOUD = "https://cloud.51degrees.com/api/v4/";

  // The meanings published in the Human Confidence documentation.
  var MEANINGS = {
    High: "High confidence that a person is reading the page.",
    Medium: "Mixed signals. Could be a person, could be a script.",
    Low: "Almost certainly no person is reading it.",
    Unknown: "Not measured, usually because the script didn't run."
  };

  var CONFIGURE_URL = "https://51degrees.com/configure/AQRVdgJ-fPDE5gU130g?utm_source=github&utm_medium=example&utm_campaign=51degrees-node&utm_content=human-confidence-demo.js&utm_term=resource-key-required";
  var PRICING_URL = "https://51degrees.com/pricing?utm_source=github&utm_medium=example&utm_campaign=51degrees-node&utm_content=human-confidence-demo.js&utm_term=pro-plan-required";
  var CONTACT_URL = "https://51degrees.com/contact-us?utm_source=github&utm_medium=example&utm_campaign=51degrees-node&utm_content=human-confidence-demo.js&utm_term=pro-plan-required";

  var script = null;

  function link(href, text) {
    var a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    return a;
  }

  function show(value, meaning, noteParts) {
    var big = document.getElementById("value");
    big.textContent = value || " ";
    big.className = "big" + (MEANINGS[value] ? " " + value : "");
    document.getElementById("meaning").textContent = meaning || "";
    var note = document.getElementById("result-note");
    note.textContent = "";
    (noteParts || []).forEach(function (part) {
      note.appendChild(typeof part === "string"
        ? document.createTextNode(part) : part);
    });
    note.hidden = !noteParts;
  }

  function showResult(data) {
    var derived = data && data.derived;
    var value = derived && derived.humanconfidence;
    var reason = derived && derived.humanconfidencenullreason;
    if (value) {
      show(value, MEANINGS[value] || "");
    } else if (typeof reason === "string" && /paid/i.test(reason)) {
      show("Pro plan", "This Resource Key's plan doesn't include Human Confidence.", [
        link(PRICING_URL, "Compare plans"),
        " or ",
        link(CONTACT_URL, "contact us"),
        " to get it."
      ]);
    } else {
      show("Not in this key", "This Resource Key doesn't include Human Confidence.", [
        link(CONFIGURE_URL, "Create a key"),
        " with the properties it needs already ticked."
      ]);
    }
  }

  function load(key) {
    if (!key) {
      show("", "", [
        "This page needs a Resource Key with Human Confidence. ",
        link(CONFIGURE_URL, "Create one"),
        ", then paste it into the form."
      ]);
      return;
    }
    show("…", "Waiting for the 51Degrees script.");
    if (script) script.remove();
    script = document.createElement("script");
    script.src = CLOUD + encodeURIComponent(key) + ".js";
    script.onload = function () {
      if (typeof fod === "undefined") {
        show("", "The 51Degrees script didn't start. Check the Resource Key.");
        return;
      }
      fod.complete(showResult);
    };
    script.onerror = function () {
      show("", "The 51Degrees script didn't load. Check the Resource Key, " +
        "and that its domain list includes this page's address.");
    };
    document.head.appendChild(script);
  }

  document.getElementById("key-form").addEventListener("submit", function (event) {
    event.preventDefault();
    load(document.getElementById("resource-key").value.trim());
  });

  load(RESOURCE_KEY);
})();
