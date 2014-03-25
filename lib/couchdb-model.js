/**
 * CouchDB Model
 * @module Model
 * @requires nano
 * @requires node.extend
 */

var extend = require('node.extend');
var uuid = require('node-uuid');
var string = require('underscore.string');
require('array.prototype.find');

/**
 * Constructor for models
 * @constructor
 * @private
 * @param {object} databaseHandle a nano db handle (returned by nano.use(db)
 * @param {object} [options] options VO
 * @param {[object|string]} options.views array of view descriptors. 
 * A view descriptior can be either a string, or an object.
 * @param {string} options.views[] view URL, such as 
 * '_design/article/_view/by_date'
 * @param {string} options.views[].url view URL, 
 * such as '_design/article/_view/by_date'
 * @param {string} [options.views[].name] name of the view 
 * to be used in generated method names. Should be all-lowercase, underscored. 
 * If not set, the last portion of the view URL will be used.
 */
function Model(databaseHandle, options) {
	this._useNanoDB(databaseHandle);
	this.instanceConstructor = Instance;

	this._views = {};

	// parse options
	if (options && Array.isArray(options.views)) {
		options.views.forEach(function(e) {
			var name, path;
			if (typeof e === "string") {
				// get the last portion of URL as the view name
				name = e.split('/').slice(-1)[0];
				path = e;
			} else if (typeof e === "object") {
				name = e.name || e.path.split('/').slice(-1)[0];
				path = e.path;
			}

			this._views[name] = {
				path: path,
				name: name,
				findOne: null,
				findMany: null
			};
		}.bind(this));
	}

	// create shortcut methods for views
	var createViewMethod = function(view, many) {
		/**
		 * find one result by view
		 * signature: findOne{viewname}(startkey, [[[endkey], sort], skip], callback)
		 * @method findOne{viewName} 
		 * @param {mixed} startkey
		 * @param {mixed} [endkey] if startkey is null, a params object 
		 * must be placed here
		 * @param {string} [sort] "asc" or "dsc"
		 * @param {number} [skip] skip the first `skip` elements
		 * @param {function(error, {#instanceConstructor} result)} callback
		 */
		/**
		 * Find one result by view
		 * signature: findOne{viewname}(null, params, callback)
		 * @method findOne{viewName}
		 * @param {null} null must be null
		 * @param {object} params request parameters passed to couchdb
		 * @param {function(error, {#instanceConstructor} result)} callback
		 */
		/**
		 * Find many by view
		 * Signature: 
		 * findMany{ViewName}(startkey, [[[[endkey], sort], limit], skip], callback)
		 * @method findMany{viewName}
		 * @param {mixed} startkey
		 * @param {mixed} [endkey] if startKey is null, a params object 
		 * must be placed here
		 * @param {string} [sort] "asc" or "dsc"
		 * @param {number} [limit] limit the results to `limit` elements
		 * @param {number} [skip] skip the first `skip` elements
		 * @param {function(error, {[#instanceConstructor]} result)} callback
		 */
		/**
		 * Find many by view
		 * signature: findMany{ViewName}(null, params, callback)
		 * @method findMany{ViewName}
		 * @param {null} null must be null
		 * @param {object} params request parameters passed to couchdb
		 * @param {function(error, {[#instanceConstructor]} result)} callback
		 */
		return function(startkey, endkey, sort, limit, skip, callback) {
			var params;

			// normalize parameters
			callback = Array.prototype.slice.call(arguments).find(function(e) {
				return typeof e === 'function';
			});

			// find(null, params) type call
			if (startkey === null && typeof endkey === 'object') {
				params = endkey;
			} else if (startkey === null && typeof endkey !== 'object') {
				throw new error('Illegal invocation');
			}
			// find(startkey, endkey, ...) type call
			if (!params) {
				params = {};
				if (!endkey || typeof endkey === 'function') {
					params.key = startkey;
				} else {
					params.startkey = startkey;
					params.endkey = endkey;
				}

				if (!many) {
					// limit is not applicable for findOne
					skip = limit;
				}				
				
				if (sort && sort == 'dsc') params.descending = true;
				if (limit && typeof limit !== 'function') params.limit = limit;
				if (skip && typeof skip !== 'function') params.skip = skip;
			}

			if (many)
				this.findManyByView(view.path, params, callback);					
			else 
				this.findOneByView(view.path, params, callback);
		};
	};

	for (var name in this._views) {
		// we add an underscore prefix so camelize will start it with a 
		// capital letter
		var methodName = string.camelize('_' + name);

		this['findOne' + methodName] = this._views[name].findOne =
			createViewMethod(this._views[name], false);
		this['findMany' + methodName] = this._views[name].findMany =
			createViewMethod(this._views[name], true);
	}
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
	 * View descriptors keyed by view name
	 * @field _views
	 * @type object}
	 * @private
	 */
	_views: null,
	/**
	 * Create a new instance
	 * @method create
	 * @param {object} data
	 * @param {string} data._id unique ID. If not set, it will get an ID
	 * after a successful save.
	 */
	create: function(data) {
		return new this.instanceConstructor(this, data);
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
	 * @method findOneByID
	 * @param {string} id
	 * @param {function(error, result)} callback result will the instance
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
	 * Find elements in a view.
	 * @method findManyByView
	 * @param {string} viewPath path to the view, like 
	 * '_design/articles/_view/by_tag'
	 * @param {object} params query string parameters to be passed to couch
	 * @param {function(error, result)} callback result will be an array of
	 * instances
	 */
	findManyByView: function(viewPath, params,	callback) {
		this._db.get(viewPath, params, function(error, results) {
			if (error) callback.apply(this, arguments);
			else {
				var instances = [];

				results.rows.forEach(function(e) {
					instances.push(
						new this.instanceConstructor(this, e.value)
					);
				}.bind(this));

				callback.call(this, null, instances);
			}
		}.bind(this));
	}, 
	/**
	 * Find only one element in a view.
	 * @method findOneByView
	 * @param {string} viewPath path to the view, like 
	 * '_design/articles/_view/by_tag'
	 * @param {object} params query string parameters to be passed to couch
	 * limit will be ignored and set to 1.
	 * @param {function(error, result)} callback result will be an array of
	 * instances
	 */
	findOneByView: function(viewPath, params, callback) {
		var _params = extend({}, params, { limit: 1 });

		this.findManyByView(viewPath, _params, function(error, results) {
			if (error) callback.apply(this, arguments);
			else callback.call(this, null, results[0]);
		});
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
	 * @type {string}
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

module.exports = function(databaseHandle, options) {
	return new Model(databaseHandle, options);
};

module.exports.Model = Model;
module.exports.Instance = Instance;
