/**
 * CouchDB Model
 * @module CouchDBModel
 * @requires nano
 * @requires node.extend
 */

var extend = require('node.extend');

/**
 * @constructor
 * @param {object} databaseHandle a nano db handle (returned by nano.use(db)
 */
function CouchDBModel(databaseHandle) {
	this._useNanoDB(databaseHandle);
}

CouchDBModel.prototype = {
	/**
	 * Set a nano database handle to use.
	 * This must be called before any other database operation.
	 * @method _useNanoDB
	 * @private
	 * @param {object} name a nano db handle (returned by nano.use(db))
	 */
	_useNanoDB: function(handle) {
		this._db = handle;
	},
	/**
	 * Database to use. It's a handle returned by nano.use
	 * @field _db
	 * @type {object}
	 * @private
	 */
	_db: null,
	/**
	 * Find an database document by ID
	 * @param {string} id
	 * @param {function(error, result)} callback result will be the document
	 */
	findOneByID: function(id, callback) {
		if (!this._db) throw new Error('No database set!');

		this._db.get(id, function(error, data) {
			if (error) {
				callback(error, null);
			}

			else callback(null, this._modelConstructor(data));
		});
	},
};

/**
 * Utility to apply the mixin to your model constructor.
 * It extends the target constructor with CocuhDBModel's static methods,
 * and its prototype with the CouchDBModel prototype.
 */
function mixin(target, source) {
	if (typeof target !== "function") {
		throw new Error('target should be a constructor.');
	}

	if (typeof source !== "function") {
		throw new Error('source should be a constructor.');
	}

	// copy static methods
	Object.keys(source).forEach(function(k) {
		if (typeof source[k] === "function") {
			target[k] = source[k];
		}
	});

	// extend prototype
	extend(true, target.prototype, source.prototype);
}

module.exports = function(options) {

};
