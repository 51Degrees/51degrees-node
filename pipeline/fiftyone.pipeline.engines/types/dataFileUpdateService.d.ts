export = DataFileUpdateService;
/**
 * @typedef {import('fiftyone.pipeline.core').Pipeline} Pipeline
 * @typedef {import('./dataFile')} DataFile
 */
/**
 * Datafiles attached to FlowElements register with
 * the dataFileUpdateService so the datafiles can receive
 * automatic updates
 **/
declare class DataFileUpdateService {
    /**
     * Constructor for a DataFileUpdateService
     *
     * @param {Pipeline} [pipeline]
     * pipeline the update service is attached to
     **/
    constructor(pipeline?: Pipeline);
    /**
     * @type {EventEmitter}
     */
    eventEmitter: EventEmitter;
    /**
     * Method to register a pipeline with the update service
     *
     * @param {Pipeline} [pipeline] Pipeline to register
     */
    registerPipeline(pipeline?: Pipeline): void;
    pipeline: import("fiftyone.pipeline.core/types/pipeline");
    /**
     * EventEmitter's 'on' delegation
     *
     * @param {string | symbol}  listener listener
     * @param {Function} callback callback
     */
    on(listener: string | symbol, callback: Function): void;
    /**
     * EventEmitter's 'once' delegation
     *
     * @param {string | symbol} listener listener
     * @param {Function} callback callback
     */
    once(listener: string | symbol, callback: Function): void;
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
    log(level: string, message: any): void;
    /**
     * Reports how an update ended, to the listeners of 'updateComplete' and
     * to the data file's own onUpdateComplete function, if it has one. An
     * error thrown by any of them is logged, goes no further, and the
     * callbacks after it are not called.
     *
     * @param {DataFile} dataFile the data file the update was for
     * @param {string} status one of the AutoUpdateStatus values
     */
    complete(dataFile: DataFile, status: string): void;
    /**
     * The message for a data update service that could not be reached.
     *
     * @param {DataFile} dataFile the data file being updated
     * @returns {string} the message to log
     */
    accessError(dataFile: DataFile): string;
    /**
     * Refreshes the engine of a data file with the data now in place, and
     * logs a failure. The caller reports the outcome.
     *
     * @param {DataFile} dataFile the data file to refresh
     * @param {boolean} [fromFile] true where the data came from a file that
     * was written, which is the case the message names a try count for
     * @returns {boolean} true if the refresh worked
     */
    refreshDataFile(dataFile: DataFile, fromFile?: boolean): boolean;
    /**
     * Ends an update that failed, so that the next one can be scheduled.
     *
     * @param {DataFile} dataFile the data file being updated
     * @param {string} status the AutoUpdateStatus to report
     */
    fail(dataFile: DataFile, status: string): void;
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
    updateDataFile(dataFile: DataFile, automatic?: boolean): boolean | void;
    /**
     * Logs an error that has no message of its own, with its cause.
     *
     * @param {DataFile} dataFile the data file being updated
     * @param {*} error the error, or whatever was thrown
     */
    unhandled(dataFile: DataFile, error: any): void;
    /**
     * Logs a download whose MD5 hash does not match the one the response
     * carried.
     *
     * @param {DataFile} dataFile the data file being updated
     * @param {string} serverHash the hash the response carried
     * @param {string} downloadHash the hash of the data that arrived
     */
    integrityFailed(dataFile: DataFile, serverHash: string, downloadHash: string): void;
    /**
     * Internal method called when the datafile has
     * been downloaded and is ready after an update
     *
     * @param {DataFile} dataFile the datafile that is ready
     * @param {string} filename the filename of the updated datafile
     * @returns {void}
     */
    fileReady(dataFile: DataFile, filename: string): void;
    /**
     * Internal method to process the datafile has been downloaded
     * Including unzipping if needed
     *
     * @param {DataFile} dataFile the datafile to processs
     * @param {string} filename the filename of the downloaded data
     */
    processFile(dataFile: DataFile, filename: string): void;
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
    updateFromMemory(dataFile: DataFile, buffer: Buffer | Uint8Array): boolean;
    /**
     * Internal method to check the next update of a
     * datafile at a polling interval set on the datafile
     *
     * @param {DataFile} dataFile the datafile to check updates for
     */
    checkNextUpdate(dataFile: DataFile): void;
    /**
     * Method that registers a datafile with the update service
     *
     * @param {DataFile} dataFile the datafile to register
     */
    registerDataFile(dataFile: DataFile): void;
}
declare namespace DataFileUpdateService {
    export { Pipeline, DataFile };
}
import EventEmitter = require("events");
type Pipeline = import("fiftyone.pipeline.core/types/pipeline");
type DataFile = import("./dataFile");
