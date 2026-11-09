/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

const engines = require('fiftyone.pipeline.engines');

const Engine = engines.Engine;
const ShareUsageEvidenceKeyFilter = require('./shareUsageEvidenceKeyFilter');
const ShareUsageTrackerEvidenceKeyFilter = require('./shareUsageTrackerEvidenceKeyFilter');
const ShareUsageTracker = require('./shareUsageTracker');
const ShareUsageBackOff = require('./shareUsageBackOff');
const zlib = require('zlib');
const url = require('url');

const os = require('os');

/**
 * The maximum length of a piece of evidence's value which can be
 * added to the usage data being sent.
 */
const SHARE_USAGE_MAX_EVIDENCE_LENGTH = 512;

const SHARE_USAGE_VERSION = '1.1';

/**
 * The default maximum number of entries waiting to be sent, unless ten times
 * the requested package size is larger.
 */
const MAX_QUEUE_SIZE_DEFAULT = 1000;

/**
 * While the queue is full, a message is logged for the first entry dropped
 * and then once for every this many more, never one for each entry.
 */
const QUEUE_FULL_LOG_EVERY = 1000;

/**
 * The most characters of an answer's content that are logged.
 */
const LOGGED_CONTENT_LENGTH = 500;

/**
 * The default time in milliseconds to wait for the service to answer.
 */
const REQUEST_TIMEOUT_DEFAULT = 60000;

/**
 * The longest single wait during a pause. Longer pauses are waited out in
 * parts, as a timer cannot wait longer than about 24 days.
 */
const LONGEST_WAIT_MILLIS = 86400000;

/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */

/**
 * The ShareUsage element sends usage data to 51Degrees in zipped batches
 */
class ShareUsage extends Engine {
  /**
   * Constructor for ShareUsage engine
   *
   * @param {object} options settings object for share usage.
   * @param {number} options.interval If exactly the same evidence values
   * are seen multiple times within this time limit (in milliseconds) then
   * they will only be shared once.
   * @param {number} options.requestedPackageSize The usage element
   * will group data into single requests before sending it.
   * This setting controls the minimum number of entries before
   * data is sent.
   * If you are sharing large amounts of data, increasing this value
   * is recommended in order to reduce the overhead of sending HTTP
   * messages.
   * For example, the 51Degrees cloud service uses a value of 2500.
   * @param {string} options.cookie The name of the cookie that holds the
   * session id. It has no effect unless trackSession is true. The cookie
   * itself is not shared unless shareAll is true.
   * @param {Array<string>|null} options.queryWhitelist By default query
   * string and HTTP form parameters are not shared unless prefixed with
   * '51D_'. If you need to share query string parameters, a list can be
   * specified here. null shares every parameter.
   * @param {Array<string>} options.headerBlacklist By default, all HTTP
   * headers except Cookie are shared. Individual headers can
   * be excluded from sharing by adding them to this list.
   * @param {number} options.sharePercentage approximate proportion of
   * requests to be shared. 1 = 100%, 0.5 = 50%, etc..
   * @param {string} options.endpoint The target destination for usage
   * sharing data. The default is https://devices-v4.51degrees.com/new.ashx.
   * @param {boolean} options.shareAll If true, all evidence is shared apart
   * from the email address, the salt used for hashed email identifiers, and
   * the request's query string and path. False by default.
   * @param {boolean} options.trackSession If true, the cookie named by
   * cookie is used to tell user sessions apart, so evidence already shared
   * is shared again when it comes from a new session. False by default. It
   * needs cookie to be set, and has no effect when shareAll is true,
   * because every cookie is then shared and used to find repeats.
   * @param {number} options.maximumQueueSize The most entries held while
   * waiting to be sent. When the queue is full, new entries are dropped. The
   * default is 1000, or ten times requestedPackageSize if that is larger.
   * @param {number} options.requestTimeout The time in milliseconds to wait
   * for the service to answer before the send counts as failed. 60000 by
   * default.
   * @param {number} options.failuresToEnterRecovery The number of failed
   * sends within failuresWindowSeconds that pauses sending, from 1 to 100.
   * Usage data is still queued while sending is paused. 10 by default.
   * @param {number} options.failuresWindowSeconds The time in seconds over
   * which failed sends are counted. 100 by default.
   * @param {number} options.initialRecoveryDelaySeconds The length in
   * seconds of the first pause after failed sends. 2 by default.
   * @param {number} options.maxRecoveryDelaySeconds The longest a pause can
   * be, in seconds. 300 by default.
   * @param {number} options.recoveryMultiplier What the pause is multiplied
   * by each time the send tried when a pause ends fails. 2 by default.
   */
  constructor (
    {
      interval = 1200000,
      requestedPackageSize = 10,
      cookie,
      queryWhitelist,
      headerBlacklist,
      sharePercentage = 1,
      endpoint = 'https://devices-v4.51degrees.com/new.ashx',
      shareAll = false,
      trackSession = false,
      maximumQueueSize,
      requestTimeout = REQUEST_TIMEOUT_DEFAULT,
      failuresToEnterRecovery,
      failuresWindowSeconds,
      initialRecoveryDelaySeconds,
      maxRecoveryDelaySeconds,
      recoveryMultiplier
    } = {}) {
    super(...arguments);

    this.trackingCookie = cookie;

    this.shareAll = shareAll;

    this.trackSession = trackSession;

    // The session id and sequence number are kept in evidence, as the usage
    // data carries them separately.
    const options = {
      cookie,
      queryWhitelist: queryWhitelist === null
        ? null
        : [...(queryWhitelist || []), 'session-id', 'sequence'],
      headerBlacklist,
      shareAll
    };

    // When sessions are tracked, the pipeline keeps the session cookie for
    // the tracker. The data sent leaves it out unless all evidence is
    // shared.
    this.evidenceKeyFilter = new ShareUsageEvidenceKeyFilter(
      { ...options, includeSession: trackSession });
    this.dataEvidenceKeyFilter = new ShareUsageEvidenceKeyFilter(
      { ...options, includeSession: false });
    this.trackerEvidenceKeyFilter = new ShareUsageTrackerEvidenceKeyFilter(
      { ...options, includeSession: trackSession });

    this.dataKey = 'shareUsage';

    this.tracker = new ShareUsageTracker({ interval });

    this.requestedPackageSize = requestedPackageSize;

    this.sharePercentage = sharePercentage;

    // The entries waiting to be sent, oldest first.
    this.shareData = [];

    // The entries dropped since the queue last had room.
    this.dropped = 0;

    this.maximumQueueSize = maximumQueueSize === undefined
      ? Math.max(MAX_QUEUE_SIZE_DEFAULT, 10 * requestedPackageSize)
      : maximumQueueSize;
    if (!(this.maximumQueueSize >= requestedPackageSize)) {
      throw new RangeError(
        'maximumQueueSize cannot be smaller than requestedPackageSize.');
    }

    this.requestTimeout = requestTimeout;

    // Pauses sending after repeated failed sends.
    this.backOff = new ShareUsageBackOff({
      failuresToEnterRecovery,
      failuresWindowSeconds,
      initialRecoveryDelaySeconds,
      maxRecoveryDelaySeconds,
      recoveryMultiplier
    });

    // True while a message is being sent. One is sent at a time.
    this.sending = false;

    // Starts sending again when a pause ends.
    this.resumeTimer = null;

    if (endpoint.includes('https://') === false &&
      endpoint.includes('http://') === false) {
      endpoint = 'https://' + endpoint;
    }
    this.endpoint = new url.URL(endpoint);
    switch (this.endpoint.protocol) {
      case 'http:':
        this.http = require('http');
        break;
      case 'https:':
        this.http = require('https');
        break;
    }
  }

  /**
   * Internal process method which uses the ShareUsageTracker
   * to determine whether to add usage data to a batch and adds it if necessary.
   *
   * @param {FlowData} flowData flowData to process
   */
  processInternal (flowData) {
    if (Math.random() <= this.sharePercentage) {
      const cacheKey = this.trackerEvidenceKeyFilter
        .filterEvidence(flowData.evidence.getAll());

      const share = this.tracker.track(cacheKey);
      if (share) {
        this.tracker.put(cacheKey);

        this.addToShareUsage(this.getDataFromEvidence(flowData));
      }
    }
  }

  /**
   * Creates a ShareUsageData instance populated from the evidence
   * within the flow data provided.
   *
   * @param {FlowData} flowData the flow data containing the evidence to use
   * @returns {ShareUsageData} New ShareUsageData instance, populated from the evidence
   * provided
   */
  getDataFromEvidence (flowData) {
    const data = new ShareUsageData();

    Object.keys(flowData.evidence.getAll()).forEach(key => {
      const value = flowData.evidence.get(key);
      if (key === 'server.client-ip') {
        // The client IP is dealt with separately for backwards
        // compatibility purposes.
        data.clientIP = value;
      } else if (key === 'query.session-id') {
        // The SessionID is dealt with separately.
        data.sessionId = value;
      } else if (key === 'query.sequence') {
        // The Sequence is dealt with separately.
        const sequence = parseInt(value);

        if (isNaN(sequence) === false) {
          data.sequence = sequence;
        } else {
          this._log('error',
            `The value '${value}' could not be parsed to an integer.`);
        }
      } else {
        // Check if we can send this piece of evidence
        if (this.dataEvidenceKeyFilter.filterEvidenceKey(key)) {
          data.tryAddToData(key, value);
        }
      }
    });
    return data;
  }

  getConstantXml () {
    if (!this.constantXml) {
      const osVersion = `${new ReplacedString(process.platform).result} ${new ReplacedString(os.release()).result}`;
      const nodeVersion = new ReplacedString(process.versions.node).result;

      let xml = '';

      // The version number of the Pipeline API
      xml += '<Version>4.4.7</Version>';
      // Write Pipeline information
      // The product name
      xml += '<Product>Pipeline</Product>';
      // The flow elements in the current pipeline
      this.getFlowElements().forEach(element => {
        xml += `<FlowElement>${element}</FlowElement>`;
      });
      xml += '<Language>Node.JS</Language>';
      // The software language version
      xml += `<LanguageVersion>${nodeVersion}</LanguageVersion>`;
      // The OS name and version
      xml += `<Platform>${osVersion}</Platform>`;
      this.constantXml = xml;
    }
    return this.constantXml;
  }

  /**
   * Internal method which adds to the share usage bundle (generating XML)
   *
   * @param {object} data key value store of current
   * evidence in FlowData (filtered by the ShareUsageEvidenceKeyFilter)
   */
  addToShareUsage (data) {
    // When the queue is full, the newest entries are dropped.
    if (this.shareData.length >= this.maximumQueueSize) {
      this.dropped++;
      if (this.dropped === 1 || this.dropped % QUEUE_FULL_LOG_EVERY === 0) {
        this._log('warning', 'The usage sharing queue is full at ' +
          `${this.maximumQueueSize} entries, so usage data is being ` +
          `dropped. ${this.dropped} entries have been dropped since the ` +
          'queue last had room.');
      }
      return;
    }
    this.dropped = 0;

    let xml = '';

    xml += '<Device>';

    // --- write invariant data
    xml += this.getConstantXml();

    // --- write variable data
    // The SessionID used to track a series of requests
    xml += `<SessionId>${data.sessionId}</SessionId>`;
    // The sequence number of the request in a series of requests.
    xml += `<Sequence>${data.sequence}</Sequence>`;
    // The client IP of the request
    xml += `<ClientIP>${data.clientIP}</ClientIP>`;

    // The UTC date/time this entry was written
    const date = new Date().toISOString();

    xml += `<DateSent>${date}</DateSent>`;

    // Write all other evidence data that has been included.
    Object.keys(data.evidenceData).forEach(categoryKey => {
      const categoryValue = data.evidenceData[categoryKey];
      Object.keys(categoryValue).forEach(entryKey => {
        const entryValue = categoryValue[entryKey];
        const replacedString = new ReplacedString(entryValue);
        // Write start element
        if (categoryKey.length > 0) {
          xml += `<${categoryKey} Name="${entryKey}"`;
        } else {
          xml += `<${entryKey}`;
        }
        // Write any attributes
        if (replacedString.replaced) {
          xml += ' replaced="true"';
        }
        if (replacedString.truncated) {
          xml += ' truncated="true"';
        }
        // End the start element
        xml += '>';
        // Write the value
        xml += replacedString.result;
        // Write end element
        if (categoryKey.length > 0) {
          xml += `</${categoryKey}>`;
        } else {
          xml += `</${entryKey}>`;
        }
      });
    });

    xml += '</Device>';

    this.shareData.push(xml);

    this.sendShareUsage();
  }

  /**
   * Internal method to start sending the share usage bundle to the 51Degrees
   * servers. Nothing starts if a message is already being sent, if fewer
   * than requestedPackageSize entries are queued, or while sending is paused
   * after failed sends, in which case a timer starts sending when the pause
   * ends.
   */
  sendShareUsage () {
    if (this.sending) {
      return;
    }
    const pause = this.backOff.remaining(ShareUsageBackOff.now());
    if (pause > 0) {
      this.scheduleResume(pause);
      return;
    }
    if (this.shareData.length < this.requestedPackageSize) {
      return;
    }
    this.sending = true;
    this.sendNext();
  }

  /**
   * Start sending when the pause ends.
   *
   * @param {number} pause the milliseconds until the pause ends
   */
  scheduleResume (pause) {
    if (this.resumeTimer) {
      return;
    }
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      this.sendShareUsage();
    }, Math.min(pause, LONGEST_WAIT_MILLIS));
    // The timer does not keep the process running.
    this.resumeTimer.unref();
  }

  /**
   * Send one message of at most twice requestedPackageSize entries, then the
   * next until fewer than requestedPackageSize are queued or a failed send
   * pauses sending.
   */
  sendNext () {
    const shareData = this.shareData.splice(0, 2 * this.requestedPackageSize);
    const data = `<Devices version="${SHARE_USAGE_VERSION}">${shareData.join('')}</Devices>`;
    this.post(data, accepted => {
      let pause = 0;
      if (accepted) {
        if (this.backOff.succeeded()) {
          this._log('info', 'Usage sharing resumed after a send succeeded.');
        }
      } else {
        pause = this.backOff.failed(ShareUsageBackOff.now());
        if (pause > 0) {
          this._log('warning', `Usage sharing paused for ${pause / 1000} ` +
            'seconds after failed sends. Usage data is still queued, up to ' +
            'the maximum queue size, and sending starts again when the pause ' +
            'ends.');
          this.scheduleResume(pause);
        }
      }
      if (pause > 0 || this.shareData.length < this.requestedPackageSize) {
        this.sending = false;
        return;
      }
      this.sendNext();
    });
  }

  /**
   * Post one message to the 51Degrees servers.
   *
   * @param {string} data the XML to send
   * @param {Function} done called once with true if the service accepted the
   * message, or false if the send failed
   */
  post (data, done) {
    const usageEngine = this;
    let finished = false;
    const finish = accepted => {
      if (finished === false) {
        finished = true;
        done(accepted);
      }
    };

    const options = {
      hostname: this.endpoint.hostname,
      path: this.endpoint.pathname,
      port: this.endpoint.port,
      method: 'POST',
      headers: { 'Content-Encoding': 'gzip', 'Content-Type': 'text/xml; charset=utf-8' },
      timeout: this.requestTimeout
    };

    zlib.gzip(data, function (err, buffer) {
      if (err) {
        usageEngine._log('warning', err);
        finish(false);
        return;
      }
      try {
        const req = usageEngine.http.request(options, function (res) {
          usageEngine._log('debug', `Usage data sent. Response code ${res.statusCode}`);
          if (res.statusCode === 200) {
            // Reads the answer so the connection can be used again.
            res.resume();
            finish(true);
            return;
          }
          let content = '';
          res.setEncoding('utf8');
          res.on('data', chunk => {
            if (content.length < LOGGED_CONTENT_LENGTH) {
              content += chunk;
            }
          });
          res.on('end', function () {
            usageEngine._log('warning', 'Usage sharing sent a message and ' +
              `the service answered ${res.statusCode} with content ` +
              `'${content.substring(0, LOGGED_CONTENT_LENGTH)}'.`);
            finish(false);
          });
          res.on('error', function () {
            finish(false);
          });
          res.on('close', function () {
            finish(false);
          });
        });
        req.on('timeout', function () {
          req.destroy(new Error(
            `Usage sharing had no answer within ${usageEngine.requestTimeout} ms`));
        });
        req.on('error', function (e) {
          usageEngine._log('warning', e);
          finish(false);
        });
        req.write(buffer);
        req.end();
      } catch (e) {
        usageEngine._log('warning', e);
        finish(false);
      }
    });
  }

  /**
   * Return a list of FlowElements in the pipeline.
   * If the list is null then populate from the pipeline.
   * If there are multiple or no pipelines then log an error.
   *
   * @returns {Array<FlowElement>} list of flow elements
   */
  getFlowElements () {
    if (!this.flowElements) {
      /**
       * @type {Array<FlowElement>}
       */
      this.flowElements = [];
      if (this.pipelines.length === 1) {
        const list = [];
        for (const [, value] of Object.entries(this.pipelines[0].flowElements)) {
          list.push(value.constructor.name);
        }
        this.flowElements = list;
      } else {
        // This element has somehow been registered to too
        // many (or zero) pipelines.
        // This means we cannot know the flow elements that
        // make up the pipeline so a warning is logged
        // but otherwise, the system can continue as normal.
        this._log('warn', 'Share usage element registered ' +
          `to ${this.pipelines.length > 0 ? 'too many' : 'no'}` +
          ' pipelines. Unable to send share usage information.');
      }
    }
    return this.flowElements;
  }
}

// a set of valid XML character values (ignoring valid controls x09, x0a, x0d, x85)
const VALID_XML_CHARS =
  Array.from({ length: parseInt('0x7F', 16) - parseInt('0x20', 16) }, (v, k) => k + parseInt('0x20', 16))
    .concat(
      Array.from({ length: parseInt('0x100', 16) - parseInt('0x40', 16) }, (v, k) => k + parseInt('0x40', 16)));

const IS_VALID_XML_CHAR = __getIsValidCharMap();

/**
 * Get an object describing whether a character value is valid
 *
 * @returns {object} Object of valid chars
 */
function __getIsValidCharMap () {
  const maxChar = parseInt('0x100', 16);
  const isValidChar = {};
  for (let c = 0; c <= maxChar; c++) {
    isValidChar[c] = VALID_XML_CHARS.includes(c);
  }
  return isValidChar;
}

/**
 * Replace characters that cause problems in XML with the "Replacement character"
 */
class ReplacedString {
  constructor (text) {
    this.result = '';
    this.replaced = false;
    this.truncated = false;
    if (text) {
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const length = Math.min(escapedText.length, SHARE_USAGE_MAX_EVIDENCE_LENGTH);
      this.truncated = escapedText.length > SHARE_USAGE_MAX_EVIDENCE_LENGTH;
      Array.from(escapedText.substring(0, length))
        .forEach(c => {
          if (c.charCodeAt(0) < Object.keys(IS_VALID_XML_CHAR).length && IS_VALID_XML_CHAR[c.charCodeAt(0)]) {
            this.result += c;
          } else {
            this.result += String.fromCharCode(parseInt('0xFFFD', 16));
            this.replaced = true;
          }
        });
    }
  }
}
/**
 * Internal class that is used to store details of data in memory
 * prior to it being sent to 51Degrees.
 */
class ShareUsageData {
  constructor () {
    this.evidenceData = {};
    this.sessionId = '';
    this.clientIp = '';
    this.sequence = '';
  }

  /**
   * Try to add data to shared usage
   *
   * @param {string} key key to add by
   * @param {*} value value to add
   */
  tryAddToData (key, value) {
    // Get the category and field names from the evidence key.
    let category = '';
    let field = key;

    const firstSeparator = key.indexOf('.');
    if (firstSeparator > 0) {
      category = key.substring(0, firstSeparator);
      field = key.substring(firstSeparator + 1);
    }

    // Add the evidence to the dictionary.
    let categoryDict = this.evidenceData[category];
    if (!categoryDict) {
      categoryDict = {};
      this.evidenceData[category] = categoryDict;
    }
    categoryDict[field] = value.toString();
  }
}
module.exports = ShareUsage;
