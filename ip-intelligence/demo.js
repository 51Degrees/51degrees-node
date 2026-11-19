/*
 * Asks the 51Degrees cloud service about an IP address and lists what it
 * returned. A property the Resource Key's plan doesn't cover shows as
 * "Paid plan", and one the key doesn't include shows as "Not in this key".
 */
(function () {
  "use strict";

  // The Resource Key the page uses when it opens. A visitor can use their
  // own key with the form instead.
  var RESOURCE_KEY = "";

  var CLOUD = "https://cloud.51degrees.com/api/v4/";

  var PROPERTIES = [
    { name: "ip", label: "IP address" },
    { name: "country", label: "Country" },
    { name: "locationconfidence", label: "Location confidence" },
    { name: "region", label: "Region" },
    { name: "town", label: "Town" },
    { name: "latitude", label: "Latitude" },
    { name: "longitude", label: "Longitude" },
    { name: "registeredowner", label: "Registered owner" }
  ];

  var CONFIGURE_URL = "https://51degrees.com/configure/hYzn3TV3?utm_source=github&utm_medium=example&utm_campaign=51degrees-node&utm_content=ip-intelligence-demo.js&utm_term=resource-key-required";
  var PRICING_URL = "https://51degrees.com/pricing?utm_source=github&utm_medium=example&utm_campaign=51degrees-node&utm_content=ip-intelligence-demo.js&utm_term=paid-properties";
  var CONTACT_URL = "https://51degrees.com/contact-us?utm_source=github&utm_medium=example&utm_campaign=51degrees-node&utm_content=ip-intelligence-demo.js&utm_term=paid-properties";

  var key = RESOURCE_KEY;

  function element(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  function link(href, text) {
    var a = element("a", "", text);
    a.href = href;
    return a;
  }

  function showNote(parts) {
    var note = document.getElementById("result-note");
    note.textContent = "";
    parts.forEach(function (part) {
      note.appendChild(typeof part === "string"
        ? document.createTextNode(part) : part);
    });
    note.hidden = false;
  }

  function hideNote() {
    document.getElementById("result-note").hidden = true;
  }

  function showKeyNeeded() {
    document.getElementById("result").textContent = "";
    showNote([
      "This page needs a Resource Key. ",
      link(CONFIGURE_URL, "Create one"),
      ", then paste it into the form."
    ]);
  }

  function showError(message) {
    var list = document.getElementById("result");
    list.textContent = "";
    list.appendChild(element("dd", "error", message));
    hideNote();
  }

  function showResult(ip) {
    var list = document.getElementById("result");
    list.textContent = "";
    var paid = 0;
    PROPERTIES.forEach(function (property) {
      var value = ip[property.name];
      var reason = ip[property.name + "nullreason"];
      var dd = element("dd");
      if (value !== null && value !== undefined && value !== "") {
        dd.appendChild(element("span", "", String(value)));
      } else if (typeof reason === "string" && /paid/i.test(reason)) {
        dd.appendChild(element("span", "paid", "Paid plan"));
        paid++;
      } else if (!(property.name in ip)) {
        dd.appendChild(element("span", "missing", "Not in this key"));
      } else {
        dd.appendChild(element("span", "missing", "Unknown"));
      }
      list.appendChild(element("dt", "", property.label));
      list.appendChild(dd);
    });
    if (paid > 0) {
      showNote([
        "This Resource Key's plan can't fill the rows marked Paid plan. ",
        link(PRICING_URL, "Compare plans"),
        " or ",
        link(CONTACT_URL, "contact us"),
        " to get them."
      ]);
    } else {
      hideNote();
    }
  }

  // Without an address the cloud service uses the one the request comes
  // from, which is the visitor's.
  function lookUp(address) {
    if (!key) {
      showKeyNeeded();
      return;
    }
    var options = { method: "GET" };
    if (address) {
      options = { method: "POST", body: new URLSearchParams({ "client-ip": address }) };
    }
    document.getElementById("result-title").textContent = address
      ? "What the cloud service returned for " + address + ":"
      : "What the cloud service returned for your address:";
    fetch(CLOUD + encodeURIComponent(key) + ".json", options)
      .then(function (response) {
        return response.json().then(function (json) {
          if (!response.ok) {
            var errors = json && json.errors ? json.errors.join(" ") : "";
            throw new Error(errors || "The cloud service answered " + response.status + ".");
          }
          return json;
        });
      })
      .then(function (json) {
        if (!json.ip) throw new Error("The answer had no IP Intelligence results. Check the Resource Key includes IP Intelligence properties.");
        showResult(json.ip);
      })
      .catch(function (error) {
        showError(error.message || String(error));
      });
  }

  document.getElementById("address-form").addEventListener("submit", function (event) {
    event.preventDefault();
    lookUp(document.getElementById("address").value.trim());
  });

  document.getElementById("key-form").addEventListener("submit", function (event) {
    event.preventDefault();
    key = document.getElementById("resource-key").value.trim();
    lookUp(document.getElementById("address").value.trim());
  });

  lookUp("");
})();
