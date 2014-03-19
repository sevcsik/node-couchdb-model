/**
 * CouchDB Model
 * @module Model
 * @requires nano
 * @requires node.extend
 */

var extend = require('node.extend');
var uuid = require('node-uuid');

/**
 * Constructor for models
 * @constructor
 * @private
 * @param {object} databaseHandle a nano db handle (returned by nano.use(db)
 */
function Model(databaseHandle) {
	this._useNanoDB(databaseHandle);
	this.instanceConstructor = Instance;
}

Model.prototype = {
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
	 * Create a new instance
	 * @method create
	 * @param {object} data
	 * @param {string} data.id unique ID. If not set, a UUID will be generated.
	 */
	create: function(data) {
		return new Instance(this, data);
	},
	/**
	 * Save an instance to the database.
	 * @method save
	 * @param {Instance} instance the instance to save
	 * @param {function(error)} callback
	 */
	save: function(instance, callback) {
		this._db.insert(instance.toVO(), instance.id, callback);	
	},
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

			else callback(null, new this.instanceConstructor(data));
		}.bind(this));
	},
	/**
	 * Constructor function which will be used to create instances.
	 * You can replace this function with an extended version to add your
	 * own methods to your instances.
	 * @type function(model, data)
	 */
	instanceConstructor: null
};

/**
 * Constructor to an instance
 * @class Instance
 * @constructor
 * @private
 * @param {Model} model the parent model
 * @param {object} data data to store in the database
 */
function Instance(model, data) {
	this._model = model;
	extend(this, data);
	if (!this.id) this.id = uuid.v4();

	this._id = this.id;
	this._rev = null;
}

Instance.prototype = {
	/**
	 * Persist instance to database
	 * @param {function(error)} callback
	 */
	save: function(callback) {
		this._model.save(this, function(error, body) {
			if (error) callback.apply(this, arguments);
			else {
				// save new revision
				this._rev = body.rev;
			}			
			callback.call(this, null);
		});		
	},
	/**
	 * unique ID
	 * @field _id
	 * @type {mixed}
	 */
	id: null,
	/**
	 * unique ID (alias to #id, because CouchDB expects #_id)
	 * @field _id
	 * @type {mixed}
	 */
	_id: null,
	/**
	 * revision ID - set by CouchDB
	 * @field _rev
	 * @type {string}
	 * @private
	 */
	_rev: null,
	/**
	 * parent model to the instance
	 * @field _model
	 * @private
	 * @tyoe {Model}
	 */
	_model: null,
	/**
	 * convert the instance to a value object (with functions and privates removed)
	 * @returns {object} the VO
	 */
	toVO: function() {
		var vo = extend(true, {}, this);
		for (var k in vo) {
			if ((typeof vo[k] === "function") ||
				(k[0] === '_' && k !== '_id' && k !== '_rev')) {
				delete vo[k];
			}
		}

		// Couch won't digest a null _rev, so we remove it
		if (vo._rev === null) delete vo._rev;

		return vo;
	}
};

/**
 * Utility to apply the mixin to your model constructor.
 * It extends the target constructor with CocuhDBModel's static methods,
 * and its prototype with the Model prototype.
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

module.exports = function(databaseHandle, options) {
	return new Model(databaseHandle, options);
};

module.exports.Model = Model;
module.exports.Instance = Instance;
