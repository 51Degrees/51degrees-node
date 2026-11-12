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

const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const url = require('url');
const EventEmitter = require('events');

const AutoUpdateStatus = require('./autoUpdateStatus');
const { LicenseKeys } = require('fiftyone.pipeline.core');

const minToMs = (min) => min * 60000;

// The longest delay setTimeout accepts. A longer one fires straight away.
const MaximumTimerMilliseconds = 2147483647;

// The number of times a refresh is tried before it is reported as failed.
// The .NET service names the count in the message it writes.
const RefreshTries = 1;

/**
 * The name of the engine a data file belongs to, for log messages.
 *
 * @param {DataFile} dataFile the data file
 * @returns {string} the engine's class name, or its data key where it has
 * no class of its own
 */
const engineName = function (dataFile) {
  const engine = dataFile.flowElement;
  if (!engine) {
    return String(dataFile.identifier);
  }
  const name = engine.constructor && engine.constructor.name;
  return name && name !== 'Object' ? name : String(engine.dataKey);
};

/**
 * The text of an error, for log messages.
 *
 * @param {*} error the error, or whatever was thrown
 * @returns {string} the message of the error
 */
const errorDetail = function (error) {
  return error && error.message ? error.message : String(error);
};

/**
 * A message in the words .NET uses, followed by the cause. .NET logs these
 * events with the exception attached, so the log says why the update
 * failed, and this puts the cause after the text in the same way.
 *
 * @param {string} text the message .NET writes
 * @param {*} error the error, or whatever was thrown
 * @returns {string} the message to log
 */
const withCause = function (text, error) {
  return text + (text.endsWith('.') ? ' ' : '. ') + 'Error detail: ' +
    errorDetail(error);
};

/**
 * The message for an error that has a row of its own in the specification's
 * table. .NET logs it as 'Error during check for data update' with the error
 * attached, the error carrying the row's text and then its cause, so those
 * follow the text in that order.
 *
 * @param {string} rowText the row's message
 * @param {*} [cause] the error that caused it, where there is one
 * @returns {string} the message to log
 */
const checkErrorText = function (rowText, cause) {
  const text = withCause('Error during check for data update', rowText);
  return cause === undefined ? text : withCause(text, cause);
};

/**
 * The message for an error with no message of its own, such as one an
 * update complete callback throws. .NET logs it as an unhandled error, in
 * these words, with the exception attached, so the cause follows the text.
 *
 * @param {DataFile} dataFile the data file the update was for
 * @param {*} error the error, or whatever was thrown
 * @returns {string} the message to log
 */
const unhandledErrorText = function (dataFile, error) {
  return withCause('An unhandled error occurred while checking for ' +
    "automatic updates for engine '" + engineName(dataFile) + "'", error);
};

/**
 * The value for the If-Modified-Since header of a request for new data. It
 * is the published date of the data file, or the last time the file at its
 * path changed where the data file has no published date. The date is an
 * HTTP date, as RFC 9110 section 5.6.7 sets.
 *
 * @param {DataFile} dataFile the data file being updated
 * @returns {string | undefined} the header value, or undefined where there
 * is no date to send
 */
const ifModifiedSince = function (dataFile) {
  try {
    const published = dataFile.getDatePublished();
    if (published instanceof Date && published.getTime() > 0) {
      return published.toUTCString();
    }
  } catch (e) {
    // The data file has no published date.
  }
  try {
    return fs.statSync(dataFile.path).mtime.toUTCString();
  } catch (e) {
    // There is no file to take a date from.
  }
  return undefined;
};

// The timer and the watcher below hold the update service and the data file
// weakly. Otherwise they keep a pipeline the application no longer uses, and
// the native memory and file handles of its engine, alive until the process
// ends, because nothing stops them.

// Closes the watcher of a data file once the data file has been collected.
const watchersToClose = new FinalizationRegistry(
  (watcher) => watcher.close());

/**
 * Updates the data file once the interval has passed, unless the update
 * service or the data file has been collected by then.
 *
 * @param {WeakRef} serviceRef the update service
 * @param {WeakRef} dataFileRef the data file to update
 * @param {number} interval milliseconds to wait
 */
const scheduleUpdate = function (serviceRef, dataFileRef, interval) {
  setTimeout(function () {
    const service = serviceRef.deref();
    const dataFile = dataFileRef.deref();
    if (service && dataFile) {
      service.updateDataFile(dataFile, true);
    }
  }, interval);
};

/**
 * Refreshes the data file whenever the file at its path changes, until the
 * update service or the data file has been collected.
 *
 * @param {WeakRef} serviceRef the update service
 * @param {WeakRef} dataFileRef the data file to refresh
 */
const watchDataFile = function (serviceRef, dataFileRef) {
  const watched = dataFileRef.deref();
  if (!watched) {
    return;
  }
  const watcher = fs.watch(watched.path, { persistent: false }, function () {
    const service = serviceRef.deref();
    const dataFile = dataFileRef.deref();
    if (!service || !dataFile) {
      watcher.close();
      return;
    }
    if (!dataFile.updating) {
      // A failed refresh is logged and reported as on the update
      // route, because an error thrown from here ends the process.
      // fs.watch goes on watching, so a later file is picked up.
      if (!service.refreshDataFile(dataFile)) {
        service.complete(
          dataFile,
          AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
        return;
      }
      service.complete(dataFile, AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    }
  });
  const service = serviceRef.deref();
  if (service) {
    service.log('info', 'Creating file system watcher');
  }
  watchersToClose.register(watched, watcher);
};

/**
 * @typedef {import('fiftyone.pipeline.core').Pipeline} Pipeline
 * @typedef {import('./dataFile')} DataFile
 */

/**
 * Datafiles attached to FlowElements register with
 * the dataFileUpdateService so the datafiles can receive
 * automatic updates
 **/
class DataFileUpdateService {
  /**
   * Constructor for a DataFileUpdateService
   *
   * @param {Pipeline} [pipeline]
   * pipeline the update service is attached to
   **/
  constructor (pipeline) {
    this.registerPipeline(pipeline);
    /**
     * @type {EventEmitter}
     */
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Method to register a pipeline with the update service
   *
   * @param {Pipeline} [pipeline] Pipeline to register
   */
  registerPipeline (pipeline) {
    this.pipeline = pipeline;
  }

  /**
   * EventEmitter's 'on' delegation
   *
   * @param {string | symbol}  listener listener
   * @param {Function} callback callback
   */
  on (listener, callback) {
    this.eventEmitter.on(listener, callback);
  }

  /**
   * EventEmitter's 'once' delegation
   *
   * @param {string | symbol} listener listener
   * @param {Function} callback callback
   */
  once (listener, callback) {
    this.eventEmitter.once(listener, callback);
  }

  /**
   * Writes a message to the log of the pipeline the service is attached to.
   * With no pipeline, an error is written to the console, as a pipeline
   * with no error listener does, so that it is not lost.
   *
   * The service's messages name the update URL, which carries the license
   * keys, so every one of them is masked here. The pipeline's log does not
   * mask, because each detection goes through it.
   *
   * @param {string} level the log level
   * @param {*} message the message
   */
  log (level, message) {
    message = LicenseKeys.mask(message);
    if (this.pipeline) {
      this.pipeline.log(level, message);
    } else if (level === 'error') {
      console.error(message);
    }
  }

  /**
   * Reports how an update ended, to the listeners of 'updateComplete' and
   * to the data file's own onUpdateComplete function, if it has one. An
   * error thrown by any of them is logged, goes no further, and the
   * callbacks after it are not called.
   *
   * @param {DataFile} dataFile the data file the update was for
   * @param {string} status one of the AutoUpdateStatus values
   */
  complete (dataFile, status) {
    // The status is reported from timer, request and file system watcher
    // callbacks, so a callback that throws is logged rather than left
    // uncaught, which would end the process. The callbacks after it are not
    // called, as the specification and .NET have it. The raw listeners are
    // called so that a 'once' listener is removed as emit would remove it.
    try {
      for (const listener of this.eventEmitter.rawListeners('updateComplete')) {
        listener.call(this.eventEmitter, status, dataFile);
      }
      if (typeof dataFile.onUpdateComplete === 'function') {
        dataFile.onUpdateComplete(status);
      }
    } catch (e) {
      this.log('error', unhandledErrorText(dataFile, e));
    }
  }

  /**
   * The message for a data update service that could not be reached.
   *
   * @param {DataFile} dataFile the data file being updated
   * @returns {string} the message to log
   */
  accessError (dataFile) {
    return "Error accessing data update service at '" + dataFile.updateUrl +
      "' for engine '" + engineName(dataFile) + "'";
  }

  /**
   * Refreshes the engine of a data file with the data now in place, and
   * logs a failure. The caller reports the outcome.
   *
   * @param {DataFile} dataFile the data file to refresh
   * @param {boolean} [fromFile] true where the data came from a file that
   * was written, which is the case the message names a try count for
   * @returns {boolean} true if the refresh worked
   */
  refreshDataFile (dataFile, fromFile = true) {
    this.log('info', "Attempting to refresh Engine '" +
      engineName(dataFile) + "' with new data");
    try {
      dataFile.refresh();
    } catch (e) {
      this.log('error', checkErrorText('An error occurred when applying a ' +
        "data update to engine '" + engineName(dataFile) + "'" +
        (fromFile ? ' after ' + RefreshTries + ' tries.' : '.'), e));
      return false;
    }
    return true;
  }

  /**
   * Ends an update that failed, so that the next one can be scheduled.
   *
   * @param {DataFile} dataFile the data file being updated
   * @param {string} status the AutoUpdateStatus to report
   */
  fail (dataFile, status) {
    dataFile.updating = false;
    this.complete(dataFile, status);
    this.checkNextUpdate(dataFile);
  }

  /**
   * Method that updates a datafile when it is due an update
   *
   * @param {DataFile} dataFile the datafile to update
   * @param {boolean} [automatic] true where the update is one the service
   * started itself, on start-up or when the polling interval has passed,
   * and not one an application asked for. Only the log messages differ.
   * @returns {boolean | void} returns false if already updating
   * or request failed
   */
  updateDataFile (dataFile, automatic = false) {
    const dataFileUpdateService = this;
    dataFile.attemptedDownload = true;

    if (dataFile.updating) {
      // Another check for the same data file is still running, so this one
      // has nothing left to do and is reported as in progress.
      this.complete(dataFile, AutoUpdateStatus.AUTO_UPDATE_IN_PROGRESS);
      return false;
    } else {
      dataFile.updating = true;
      dataFile.automaticUpdate = automatic === true;
    }

    this.log('info', 'Checking for update');

    // A check with no update URL has nowhere to look, so there is nothing
    // to do and the check is reported as not needed.
    if (!dataFile.updateUrl) {
      this.fail(dataFile, AutoUpdateStatus.AUTO_UPDATE_NOT_NEEDED);
      return false;
    }

    let urlParts;
    try {
      urlParts = new url.URL(dataFile.updateUrl);
    } catch (e) {
      this.log('error', checkErrorText(this.accessError(dataFile), e));
      this.fail(dataFile, AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
      return false;
    }

    const requestOptions = urlParts;

    let request;
    let modifiedSince;
    try {
      modifiedSince = dataFile.verifyIfModifiedSince
        ? ifModifiedSince(dataFile)
        : undefined;
      if (modifiedSince) {
        requestOptions.headers = { 'If-Modified-Since': modifiedSince };
      }

      this.log('info', "Checking for update from '" + dataFile.updateUrl +
        "' for Engine '" + engineName(dataFile) + "'");

      if (urlParts.protocol === 'https:') {
        request = https.get(requestOptions);
      } else {
        request = http.get(requestOptions);
      }
    } catch (e) {
      // An error here has no row of its own, so it is reported as the
      // unhandled one rather than being lost.
      this.unhandled(dataFile, e);
      this.fail(dataFile, AutoUpdateStatus.AUTO_UPDATE_UNKNOWN_ERROR);
      return false;
    }

    // Each update reports one status. Once the response has arrived its
    // handlers report how the update ended. A connection reset part way
    // through the download raises an error on the request and then closes
    // the response, so that error is left to the response's handlers.
    let responded = false;

    // Without an error listener a connection failure (for example a
    // refused or reset connection) emits an unhandled 'error' event,
    // which crashes the whole process.
    request.on('error', function (err) {
      if (responded) {
        return;
      }
      dataFileUpdateService.log(
        'error',
        checkErrorText(dataFileUpdateService.accessError(dataFile), err));

      dataFileUpdateService.fail(
        dataFile,
        AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
    });

    request.on('response', function (response) {
      responded = true;
      if (response.statusCode !== 200) {
        response.resume();

        const downloadFailed = function (message, status) {
          dataFileUpdateService.log('error', checkErrorText(message));
          dataFileUpdateService.fail(dataFile, status);
        };

        const forEngine = "' for engine '" + engineName(dataFile) + "'";

        switch (response.statusCode) {
          case (429):
            downloadFailed(
              "Too many requests to '" + dataFile.updateUrl + forEngine,
              AutoUpdateStatus.AUTO_UPDATE_ERR_429_TOO_MANY_ATTEMPTS);
            break;
          case (304):
            dataFileUpdateService.log(
              'info',
              'No data newer than ' + (modifiedSince || 'the current data') +
              " found at '" + dataFile.updateUrl +
              "' for Engine '" + engineName(dataFile) + "'");
            dataFileUpdateService.fail(
              dataFile,
              AutoUpdateStatus.AUTO_UPDATE_NOT_NEEDED);
            break;
          case (403):
            downloadFailed(
              "Access denied to data update service at '" +
              dataFile.updateUrl + forEngine,
              AutoUpdateStatus.AUTO_UPDATE_ERR_403_FORBIDDEN);
            break;
          default:
            downloadFailed(
              "HTTP status code '" + response.statusCode +
              "' from data update service at '" + dataFile.updateUrl +
              forEngine,
              AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
            break;
        }

        return false;
      };

      if (!dataFile.tempDataDirectory) {
        response.resume();
        dataFileUpdateService.log('error', checkErrorText(
          "The data file '" + dataFile.identifier + "' is checking for " +
          'updates but does not have a temporary file path configured.'));
        dataFileUpdateService.fail(
          dataFile,
          AutoUpdateStatus.AUTO_UPDATE_TEMP_PATH_NOT_SET);
        return false;
      }

      const filename = dataFile.tempDataDirectory +
        '/' + dataFile.identifier +
        Date.now();
      let written = true;
      const output = fs.createWriteStream(filename);
      // A failed write and a download cut short are each the end of the
      // update, so whichever comes first reports it.
      output.on('error', function (err) {
        response.resume();
        if (!written) {
          return;
        }
        written = false;
        dataFileUpdateService.unhandled(dataFile, err);
        dataFileUpdateService.fail(
          dataFile,
          AutoUpdateStatus.AUTO_UPDATE_NEW_FILE_CANT_RENAME);
      });
      response.pipe(output);

      // A download that ends before the whole file has arrived never
      // finishes writing, so it is reported when the response closes.
      response.on('error', function () {});
      response.on('close', function () {
        if (response.complete || !written) {
          return;
        }
        written = false;
        output.destroy();
        fs.unlink(filename, function () {});
        dataFileUpdateService.log('error', checkErrorText(
          "No response from data update service at '" + dataFile.updateUrl +
          "' for engine '" + engineName(dataFile) + "'"));
        dataFileUpdateService.fail(
          dataFile,
          AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
      });

      output.on('finish', function () {
        if (!written) {
          return;
        }

        dataFileUpdateService.log(
          'info',
          "Downloaded new data from '" + dataFile.updateUrl +
          "' for Engine '" + engineName(dataFile) + "'");

        // Open file
        if (dataFile.verifyMD5) {
          const headerMD5 = response.headers['content-md5'];

          // A response that carries no hash cannot be checked, which is a
          // warning rather than a failure, and the update goes on.
          if (!headerMD5) {
            dataFileUpdateService.log(
              'warn',
              'No MD5 hash included in data update response for ' +
              "'" + dataFile.updateUrl + "'. Unable to verify data " +
              'integrity');
            dataFileUpdateService.processFile(dataFile, filename);
            return;
          }

          const fd = fs.createReadStream(filename);

          const hash = crypto.createHash('md5');
          hash.setEncoding('hex');

          // A failed read is reported once, and the check is not made.
          let checked = false;
          fd.on('error', function (err) {
            if (checked) {
              return;
            }
            checked = true;
            dataFileUpdateService.unhandled(dataFile, err);
            fs.unlink(filename, function () {
              dataFileUpdateService.fail(
                dataFile,
                AutoUpdateStatus.AUTO_UPDATE_UNKNOWN_ERROR);
            });
          });

          fd.on('end', function () {
            if (checked) {
              return;
            }
            checked = true;
            hash.end();
            const downloadHash = hash.read();
            if (downloadHash !== headerMD5) {
              dataFileUpdateService.integrityFailed(
                dataFile, headerMD5, downloadHash);
              fs.unlink(filename, function () {
                dataFileUpdateService.fail(
                  dataFile,
                  AutoUpdateStatus.AUTO_UPDATE_ERR_MD5_VALIDATION_FAILED);
              });
            } else {
              dataFileUpdateService.processFile(dataFile, filename);
            }
          });

          fd.pipe(hash);
        } else {
          dataFileUpdateService.processFile(dataFile, filename);
        }
      });
    });
  }

  /**
   * Logs an error that has no message of its own, with its cause.
   *
   * @param {DataFile} dataFile the data file being updated
   * @param {*} error the error, or whatever was thrown
   */
  unhandled (dataFile, error) {
    this.log('error', unhandledErrorText(dataFile, error));
  }

  /**
   * Logs a download whose MD5 hash does not match the one the response
   * carried.
   *
   * @param {DataFile} dataFile the data file being updated
   * @param {string} serverHash the hash the response carried
   * @param {string} downloadHash the hash of the data that arrived
   */
  integrityFailed (dataFile, serverHash, downloadHash) {
    this.log('error', checkErrorText(
      "Integrity check failed. MD5 hash in HTTP response '" + serverHash +
      "' for '" + engineName(dataFile) + "'data update does not match " +
      "calculated hash for the downloaded file '" + downloadHash + "'."));
  }

  /**
   * Internal method called when the datafile has
   * been downloaded and is ready after an update
   *
   * @param {DataFile} dataFile the datafile that is ready
   * @param {string} filename the filename of the updated datafile
   * @returns {void}
   */
  fileReady (dataFile, filename) {
    const dataFileUpdateService = this;

    // The download is removed whether the update worked or not.
    const removeDownload = function (done) {
      fs.unlink(filename, function (err) {
        if (err) {
          dataFileUpdateService.unhandled(dataFile, err);
        }
        done();
      });
    };

    fs.readFile(filename, function (err, data) {
      if (err) {
        dataFileUpdateService.unhandled(dataFile, err);
        dataFileUpdateService.fail(
          dataFile,
          AutoUpdateStatus.AUTO_UPDATE_MASTER_FILE_CANT_RENAME);
        return;
      }

      fs.writeFile(dataFile.path, data, function (err) {
        if (err) {
          // A locked file and any other write failure are the same row,
          // so the message names the copy rather than the cause.
          dataFileUpdateService.log('error', checkErrorText(
            'An error occurred when copying a data file to replace the ' +
            "existing one at '" + dataFile.path + "'.", err));
          removeDownload(function () {
            dataFileUpdateService.fail(
              dataFile,
              AutoUpdateStatus.AUTO_UPDATE_NEW_FILE_CANT_RENAME);
          });
          return;
        }

        const refreshed = dataFileUpdateService.refreshDataFile(dataFile);
        dataFile.updating = false;
        if (!refreshed) {
          dataFileUpdateService.complete(
            dataFile,
            AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
        }
        dataFileUpdateService.checkNextUpdate(dataFile);

        // Delete the temp file
        removeDownload(function () {
          // A failed refresh has been reported already.
          if (refreshed) {
            dataFileUpdateService.complete(
              dataFile,
              AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
          }
        });
      });
    });
  }

  /**
   * Internal method to process the datafile has been downloaded
   * Including unzipping if needed
   *
   * @param {DataFile} dataFile the datafile to processs
   * @param {string} filename the filename of the downloaded data
   */
  processFile (dataFile, filename) {
    const dataFileUpdateService = this;

    if (dataFile.decompress) {
      fs.readFile(filename, function (err, buffer) {
        if (err) {
          dataFileUpdateService.unhandled(dataFile, err);
          dataFileUpdateService.fail(
            dataFile,
            AutoUpdateStatus.AUTO_UPDATE_ERR_READING_STREAM);
          return;
        }

        zlib.gunzip(buffer, function (err, data) {
          if (err) {
            // Data that will not decompress has no row of its own.
            dataFileUpdateService.unhandled(dataFile, err);
            fs.unlink(filename, function () {
              dataFileUpdateService.fail(
                dataFile,
                AutoUpdateStatus.AUTO_UPDATE_UNKNOWN_ERROR);
            });
            return;
          }

          const doneFileName = filename + '_done';

          fs.writeFile(doneFileName, data, function (err) {
            if (err) {
              dataFileUpdateService.unhandled(dataFile, err);
              dataFileUpdateService.fail(
                dataFile,
                AutoUpdateStatus.AUTO_UPDATE_NEW_FILE_CANT_RENAME);
              return;
            }
            dataFileUpdateService.fileReady(dataFile, doneFileName);
            fs.unlink(filename, function (err) {
              if (err) {
                dataFileUpdateService.unhandled(dataFile, err);
              }
            });
          });
        });
      });
    } else {
      dataFileUpdateService.fileReady(dataFile, filename);
    }
  }

  /**
   * Refreshes a data file that is held in memory with the bytes given. The
   * data file keeps the data it has if the refresh fails. Nothing is
   * downloaded and no file is written.
   *
   * @param {DataFile} dataFile the memory data file to refresh
   * @param {Buffer | Uint8Array} buffer the new data
   * @returns {boolean} false if the data file is already updating or the
   * refresh failed, which is also logged and reported through the
   * 'updateComplete' event
   */
  updateFromMemory (dataFile, buffer) {
    if (!(buffer instanceof Uint8Array)) {
      throw new TypeError('The new data must be a Buffer or a Uint8Array.');
    }
    if (dataFile.path) {
      throw new Error(
        "The data file '" + dataFile.identifier + "' is read from '" +
        dataFile.path + "', not held in memory. Use updateDataFile.");
    }

    if (dataFile.updating) {
      return false;
    }
    dataFile.updating = true;

    const previous = dataFile.data;
    dataFile.data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    // The data came from memory, not a file that was written, so the
    // message carries no try count.
    const refreshed = this.refreshDataFile(dataFile, false);
    if (!refreshed) {
      dataFile.data = previous;
    }
    dataFile.updating = false;
    this.complete(
      dataFile,
      refreshed
        ? AutoUpdateStatus.AUTO_UPDATE_SUCCESS
        : AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
    return refreshed;
  }

  /**
   * Internal method to check the next update of a
   * datafile at a polling interval set on the datafile
   *
   * @param {DataFile} dataFile the datafile to check updates for
   */
  checkNextUpdate (dataFile) {
    try {
      const dataFileUpdateService = this;

      // Run update on start if specified to do so
      if (dataFile.updateOnStart && !dataFile.attemptedDownload) {
        dataFileUpdateService.updateDataFile(dataFile, true);
        return;
      }

      if (dataFile.autoUpdate) {
        const offset = minToMs(
          Math.floor(Math.random() *
            dataFile.updateTimeMaximumRandomisation) +
          1);

        // Each check waits for the polling interval, or until the
        // data says newer data is expected where that is later. Either way
        // the random offset is added, so that servers started together do
        // not all ask at once.
        let interval = offset + minToMs(dataFile.pollingInterval);
        const nextUpdate = dataFile.getNextUpdate().getTime() - Date.now();
        if (nextUpdate > 0) {
          interval = nextUpdate + offset;
        }

        scheduleUpdate(
          new WeakRef(this),
          new WeakRef(dataFile),
          Math.min(interval, MaximumTimerMilliseconds));
      }
    } catch (e) {
      // An error here has no row of its own, so it is logged as the
      // unhandled one, with its cause.
      this.log('error', unhandledErrorText(dataFile, e));
    }
  }

  /**
   * Method that registers a datafile with the update service
   *
   * @param {DataFile} dataFile the datafile to register
   */
  registerDataFile (dataFile) {
    dataFile.registered = true;
    if (dataFile.updateOnStart) {
      this.log('info', 'Updating on start-up');
      this.updateDataFile(dataFile, true);
    } else {
      if (dataFile.autoUpdate) {
        this.checkNextUpdate(dataFile);
      }
    }

    // check if fileSystemWatcher is enabled and listen for datafile changes

    if (dataFile.autoUpdate && dataFile.fileSystemWatcher) {
      const serviceRef = new WeakRef(this);
      const dataFileRef = new WeakRef(dataFile);

      if (fs.existsSync(dataFile.path)) {
        watchDataFile(serviceRef, dataFileRef);
      } else {
        const checkWatcherCanStart = setInterval(function () {
          try {
            watchDataFile(serviceRef, dataFileRef);

            clearInterval(checkWatcherCanStart);
          } catch (e) {

          }
        }, 500);
      }
    }
  }
}

module.exports = DataFileUpdateService;
