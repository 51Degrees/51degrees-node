/*
 * Asks the 51Degrees cloud service about an IP address and lists what it
 * returned.
 */
(function () {
  "use strict";

  // This page's own Resource Key. It is public by design and the cloud
  // service accepts it only from pages on 51degrees.github.io.
  var RESOURCE_KEY = "AQRVdgJ-m5wBBHBG30g";

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

  function element(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  function showError(message) {
    var list = document.getElementById("result");
    list.textContent = "";
    list.appendChild(element("dd", "error", message));
  }

  function showResult(ip) {
    var list = document.getElementById("result");
    list.textContent = "";
    PROPERTIES.forEach(function (property) {
      var value = ip[property.name];
      var dd = element("dd");
      if (value !== null && value !== undefined && value !== "") {
        dd.appendChild(element("span", "", String(value)));
      } else {
        dd.appendChild(element("span", "missing", "Unknown"));
      }
      list.appendChild(element("dt", "", property.label));
      list.appendChild(dd);
    });
  }

  // Without an address the cloud service uses the one the request comes
  // from, which is the visitor's.
  function lookUp(address) {
    var options = { method: "GET" };
    if (address) {
      options = { method: "POST", body: new URLSearchParams({ "client-ip": address }) };
    }
    document.getElementById("result-title").textContent = address
      ? "What the cloud service returned for " + address + ":"
      : "What the cloud service returned for your address:";
    fetch(CLOUD + RESOURCE_KEY + ".json", options)
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
        if (!json.ip) throw new Error("The answer had no IP Intelligence results.");
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

  lookUp("");
})();
