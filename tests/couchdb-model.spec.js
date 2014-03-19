/**
 * Unit tests for couchdb-model
 */

var should = require('chai').should();
var couchDBModel = require('../lib/couchdb-model.js'); 
var createNano = require('nano');

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

		it('should create a model with ID, and save it correctly', 
			function(done) {
			var Model = couchDBModel(nano.use(COUCHDB_DB_NAME));

			var instance = Model.create({
				id: 'test-id',
				value: 'hello'
			});

			instance.save(function(error) {
				if (error) throw error;
				Model.findOneByID('test-id', function(error, result) {
					if (error) throw error;
					instance.should.deep.equal(result);
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
				Model.findOneByID(instance.id, function(error, result) {
					if (error) throw error;
					instance.should.deep.equal(result);
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
				Model.findOneByID(instance.id, function(error, result) {
					if (error) throw error;
					instance.should.deep.equal(result);

					instance.value = 'goodbye';
					instance.save(function(error) {
						if (error) throw error;
						Model.findOneByID(instance.id, 
						function(error, result) {
							if (error) throw error;
							result.should.deep.equal(instance);
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

			var id = instance.id;

			instance.save(function(error) {
				if (error) throw error;
				instance.delete(function(error) {
					if (error) throw error;
					Model.findById(id, function(error, data) {
						error.should.be.an(object);
						should.not.exist(data);		
						done();
					});
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

