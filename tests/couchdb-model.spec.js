/**
 * Unit tests for couchdb-model
 */

var should = require('chai').should();
var couchDBModel = require('../lib/couchdb-model.js'); 
var createNano = require('nano');
var extend = require('node.extend');

var COUCHDB_BASE_URL = process.env.COUCHDB_BASE_URL;
if (!COUCHDB_BASE_URL) {
	throw new Error(
		'$COUCHDB_BASE_URL environment variable is not set. ' + 
		'Please provide a working couchdb base URL to run the tests.');
}

var COUCHDB_DB_NAME = process.env.COUCHDB_DB_NAME || 'couchdb-model-test';

var nano = createNano(COUCHDB_BASE_URL);

describe('couchdb-model', function() {
	beforeEach(function(done) {
		nano.db.destroy(COUCHDB_DB_NAME, function() {
			nano.db.create(COUCHDB_DB_NAME, function(error) {
				if (error) throw error;
				done();
			});
		});
	});

	it('should create a model from a nano database handler', function() {
		var Model = couchDBModel(nano.use(COUCHDB_DB_NAME));
	});

	describe('simple model with ID indexing', function() {

		it('should create a model with ID', 
			function(done) {
			var Model = couchDBModel(nano.use(COUCHDB_DB_NAME));

			var instance = Model.create({
				_id: 'test-id',
				value: 'hello'
			});

			instance.save(function(error) {
				if (error) throw error;
				Model.findOneByID('test-id', function(error, result) {
					if (error) throw error;
					instance.toVO().should.deep.equal(result.toVO());
					done();
				});
			});
		});

		it('should create a model with automatic ID', function(done) {
			var Model = couchDBModel(nano.use(COUCHDB_DB_NAME));

			var instance = Model.create({
				value: 'hello'
			});

			instance.save(function(error) {
				if (error) throw error;
				Model.findOneByID(instance._id, function(error, result) {
					if (error) throw error;
					instance.toVO().should.deep.equal(result.toVO());
					done();
				});
			});
		});

		it('should update an instance correctly', function(done) {
			var Model = couchDBModel(nano.use(COUCHDB_DB_NAME));

			var instance = Model.create({
				value: 'hello'
			});

			instance.save(function(error) {
				if (error) throw error;
				Model.findOneByID(instance._id, function(error, result) {
					if (error) throw error;
					instance.toVO().should.deep.equal(result.toVO());

					instance.value = 'goodbye';
					instance.save(function(error) {
						if (error) throw error;
						Model.findOneByID(instance._id, 
						function(error, result) {
							if (error) throw error;
							result.toVO().should.deep.equal(instance.toVO());
							done();
						});
					});
				});
			});
		});

		it('should delete an instance', function(done) {
			var Model = couchDBModel(nano.use(COUCHDB_DB_NAME));

			var instance = Model.create({
				value: 'hello'
			});

			instance.save(function(error) {
				if (error) throw error;
				var id = instance._id;
				instance.delete(function(error) {
					if (error) throw error;
					Model.findOneByID(id, function(error, data) {
						error.should.be.an('object');
						should.not.exist(data);		
						done();
					});
				});
			});
		});

		it('should allow to override the constructor', function(done) {
			var Model = couchDBModel(nano.use(COUCHDB_DB_NAME));

			Model.instanceConstructor = function (model, data) {
				couchDBModel.Instance.call(this, model, data);
				// Instance constructor already applied all field in 'data' to 'this'.
				this.passwordWithAnX = 'X' + this.password;	// bulletproof encryption
				this.password = undefined;
			};

			extend(Model.instanceConstructor.prototype, couchDBModel.Instance.prototype, {
				checkPassword: function(password) {
					return this.passwordWithAnX === 'X' + password;
				}
			});

			var user = Model.create({ username: 'username', password: 'pw'});

			user.should.be.instanceof(Model.instanceConstructor);
			should.not.exist(user.password);

			user.save(function(error) {
				Model.findOneByID(user._id, function(error, result) {
					result.should.be.instanceof(Model.instanceConstructor);
					should.not.exist(user.password);
					user.passwordWithAnX.should.be.ok;
					user.checkPassword('pw').should.be.ok;
					user.checkPassword('Xpw').should.be.not.ok;
					done();
				});
			});	

		});
	});

	afterEach(function(done) {
		nano.db.destroy(COUCHDB_DB_NAME, function(error) {
			if (error) throw error;
			done();
		});
	});
});

