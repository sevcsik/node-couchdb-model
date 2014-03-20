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
	 * @param {string} data._id unique ID. If not set, it will get an ID
	 * after a successful save.
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
		this._db.insert(instance.toVO(), callback);	
	},
	/**
	 * Delete an instance from the database
	 * @method delte
	 * @param {Instance} instance instance to delete
	 * @param {function(error)} callback
	 */
	delete: function(instance, callback) {
		this._db.destroy(instance._id, instance._rev, callback);
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

			else callback(null, new this.instanceConstructor(this, data));
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
				// save new revision and id
				this._rev = body.rev;
				this._id = body.id;
			}			
			callback.call(this, null);
		}.bind(this));		
	},
	/**
	 * Delete the instance from the database. If it's saved again,
	 * it will have a new ID.
	 * @method delete
	 * @param {function(error)} callback
	 */
	delete: function(callback) {
		this._model.delete(this, function(error, body) {
			if (error) callback.apply(this, arguments);
			else {
				this._id = null;
				this._rev = null;
			}
			callback.call(this, null);
		}.bind(this));
	},
	/**
	 * unique ID in CouchDB. If null, the instance does not exist in the
	 * database.
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

		// Couch won't digest a null _rev or _id so we remove them
		if (vo._rev === null) delete vo._rev;
		if (vo._id === null) delete vo._id;

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
