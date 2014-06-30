/* global describe, beforeEach, afterEach, it, emit */

/**
 * Unit tests for couchdb-model
 */

var should = require('chai').should();
var couchDBModel = require('../lib/couchdb-model.js'); 
var createNano = require('nano');
var extend = require('node.extend');
var Q = require('q');

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
		couchDBModel(nano.use(COUCHDB_DB_NAME));
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

	describe('model with views', function() {
		var db = nano.use(COUCHDB_DB_NAME);
		var model, dd, articles;
		// create test design document in the database
		beforeEach(function(done) {
			this.timeout(10000);

			dd = {
				_id: '_design/article',
				views: {
					by_date: {
						map: function(doc) {
							emit(doc.date, doc);
						}
					},
					by_tag: {
						map: function(doc) {
							if (Array.isArray(doc.tags)) {
								doc.tags.forEach(function(e) {
									emit(e, doc);
								});
							}
						}
					},
					by_slug: {
						map: function(doc) {
							emit(doc.slug, doc);
						}
					}
				}
			};

			model = couchDBModel(db, {
				views: [
					'_design/article/_view/by_date',
					{
						path: '_design/article/_view/by_tag',
						name: 'by_one_of_the_tags'
					},
					{
						path: '_design/article/_view/by_slug'
					}
				]
			});

			// test data
			articles = [
				model.create({
					_id: '0',
					date: "1970-01-01T00:00:00",
					slug: "test_article_that_is_super_old",
					tags: []
				}),
				model.create({
					_id: '1',
					date: "2013-03-24T05:22:31",
					slug: 'test_article_one_slug',
					tags: ['one', 'odd', 'test']
				}),
				model.create({
					_id: '2',
					date: "2014-03-24T05:00:00",
					slug: 'test_article_two_slug',
					tags: ['two', 'even', 'test']
				}),
				model.create({
					_id: '3',
					date: "2014-03-24T05:22:31",
					slug: 'test_article_three_slug',
					tags: ['three', 'odd', 'test']
				}),
				model.create({
					_id: '4',
					date: "2013-03-24T05:00:00",
					slug: 'test_article_four_slug',
					tags: ['four', 'even', 'test']
				}),
			];

			// build a promise array which saves the design docs and all
			// our articles
			//
			// Both nano and chouchdb-model implement the node callback 
			// pattern so we can use Q.ninvoke on them.
			var promises = [
				Q.ninvoke(db, 'insert', dd, dd._id)
			];

			articles.forEach(function(e) {
				promises.push(Q.ninvoke(e, 'save'));
			});

			// wait for every promise to be fulfilled before continuing
			Q.all(promises).then(
				function() { done(); }, 
				function(error) { done(error); }
			);
		});

		it('should have the right methods when initialized with views', 
			function() {

			model.findOneByDate.should.be.a('function', 'one by date');
			model.findManyByDate.should.be.a('function', 'many by date');
			model.findOneByOneOfTheTags.should.be.a('function', 'one by tag');
			model.findManyByOneOfTheTags.should.be.a('function', 'many by tag');
			model.findOneBySlug.should.be.a('function', 'one by slug');
			model.findManyBySlug.should.be.a('function', 'many by slug');
		});

		it('should return the correct instance by slug', function(done) {
			Q.all([
				Q.ninvoke(model, 'findOneBySlug', 'test_article_one_slug'),
				Q.ninvoke(model, 'findManyBySlug', 'test_article_one_slug'),
			]).spread(function(oneBySlug, manyBySlug) {
				oneBySlug.should.be.an.instanceof(couchDBModel.Instance);
				oneBySlug.toVO().should.deep.equal(
					articles[1].toVO(), 'find one');
				manyBySlug.should.be.an.instanceof(Array, 'find many');
				manyBySlug.should.have.length(1, 'find many');
				manyBySlug[0].should.be.an.instanceof(couchDBModel.Instance,
					'find many');
				manyBySlug[0].toVO().should.deep.equal(articles[1].toVO(), 
					'find many');
				done();
			}).fail(function(error) { done(error); });
		});

		it('should return every instance with tag \'even\'', function(done) {
			Q.all([
				Q.ninvoke(model, 'findManyByOneOfTheTags', 'even')
			]).spread(function(manyByTags) {
				manyByTags.should.have.length(2);
				manyByTags[0].toVO().should.deep.equal(articles[2].toVO());
				manyByTags[1].toVO().should.deep.equal(articles[4].toVO());
				done();
			}).fail(function(error) { done(error); });
		});

		it('should return every article from 2014 using a key range, ' + 
			'with the correct ordering', 
			function(done) {
			Q.all([
				Q.ninvoke(model, 'findManyByDate', 
					"2014-01-01T00:00:00", "2014-12-31T23:59:59", "asc"
				),
				Q.ninvoke(model, 'findOneByDate', 
					"2014-01-01T00:00:00", "2014-12-31T23:59:59", "asc"
				),
				Q.ninvoke(model, 'findManyByDate', 
					"2014-01-01T00:00:00", "2014-12-31T23:59:59", "dsc"
				),
				Q.ninvoke(model, 'findOneByDate', 
					"2014-01-01T00:00:00", "2014-12-31T23:59:59", "dsc"
				)
			]).spread(function(manyByDateASC, oneByDateASC,
					manyByDateDSC, oneByDateDSC) {
				oneByDateASC.toVO().should.deep.equal(articles[2].toVO(), 
					'find one, asc');
				manyByDateASC.should.have.length(2, 'find many, asc');
				manyByDateASC[0].toVO().should.deep.equal(articles[2].toVO(),
					'find many, asc');
				manyByDateASC[1].toVO().should.deep.equal(articles[3].toVO(),
					'find many, asc');
				
				oneByDateDSC.toVO().should.deep.equal(articles[3].toVO(), 
					'find one, dsc');
				manyByDateDSC.should.have.length(2, 'find many, dsc');
				manyByDateDSC[0].toVO().should.deep.equal(articles[3].toVO(),
					'find many, dsc');
				manyByDateDSC[1].toVO().should.deep.equal(articles[2].toVO(),
					'find many, dsc');

				done();
			}).fail(function(error) { done(error); });
		});

		// clean up after beforeEach
		afterEach(function(done) {
			this.timeout(10000);
			
			var promises = [
				Q.ninvoke(db, 'get', dd._id).then( function(results) {
					return Q.ninvoke(db, 'destroy', dd._id, results[0]._rev);
				})
			];

			articles.forEach(function(e) {
				promises.push(Q.ninvoke(e, 'delete'));
			});

			Q.all(promises).then(
				function() { done(); }, 
				function(error) { done(error); }
			);
		});
	});

	describe('promise', function() {
		var db = nano.use(COUCHDB_DB_NAME);
		var model, dd, articles;
		// same test case as in 'view support'
		beforeEach(function(done) {
			this.timeout(10000);

			dd = {
				_id: '_design/article',
				views: {
					by_date: {
						map: function(doc) {
							emit(doc.date, doc);
						}
					},
					by_tag: {
						map: function(doc) {
							if (Array.isArray(doc.tags)) {
								doc.tags.forEach(function(e) {
									emit(e, doc);
								});
							}
						}
					},
					by_slug: {
						map: function(doc) {
							emit(doc.slug, doc);
						}
					}
				}
			};

			model = couchDBModel(db, {
				views: [
					'_design/article/_view/by_date',
					{
						path: '_design/article/_view/by_tag',
						name: 'by_one_of_the_tags'
					},
					{
						path: '_design/article/_view/by_slug'
					}
				]
			});

			// test data
			articles = [
				model.create({
					_id: '0',
					date: "1970-01-01T00:00:00",
					slug: "test_article_that_is_super_old",
					tags: []
				}),
				model.create({
					_id: '1',
					date: "2013-03-24T05:22:31",
					slug: 'test_article_one_slug',
					tags: ['one', 'odd', 'test']
				}),
				model.create({
					_id: '2',
					date: "2014-03-24T05:00:00",
					slug: 'test_article_two_slug',
					tags: ['two', 'even', 'test']
				}),
				model.create({
					_id: '3',
					date: "2014-03-24T05:22:31",
					slug: 'test_article_three_slug',
					tags: ['three', 'odd', 'test']
				}),
				model.create({
					_id: '4',
					date: "2013-03-24T05:00:00",
					slug: 'test_article_four_slug',
					tags: ['four', 'even', 'test']
				}),
			];

			// build a promise array which saves the design docs and all
			// our articles
			//
			// Both nano and chouchdb-model implement the node callback 
			// pattern so we can use Q.ninvoke on them.
			var promises = [
				Q.ninvoke(db, 'insert', dd, dd._id)
			];

			articles.forEach(function(e) {
				promises.push(Q.ninvoke(e, 'save'));
			});

			// wait for every promise to be fulfilled before continuing
			Q.all(promises).then(
				function() { done(); }, 
				function(error) { done(error); }
			);
		});

		it('to findOneByID should be fulfilled on success', function(done) {
			model.findOneByID('0').then(function(data) { 
				data.should.be.an.instanceof(couchDBModel.Instance);
				return data.toVO(); 
			}).then(function() {
				done();
			}, function(error) { 
				done(error); 
			});
		});

		it('to findOneByID should be rejected on 404', function(done) {
			model.findOneByID('nonexistent_id').then(function(result) {
				throw new Error('success branch should not have been called');
			}, function(error) {
				error.status_code.should.equal(404);
			}).then(function() {
				done();
			}, function(error) { 
				done(error); 
			});
		});

		it('to findOneBy* should be fulfilled', function(done) {
			model.findOneBySlug('test_article_one_slug').then(function(data) { 
				data.should.be.an.instanceof(couchDBModel.Instance);
				return data.toVO(); 
			}).then(function() {
				done();
			}, function(error) { 
				done(error); 
			});
		});

		it('to findManyBy* should be fulfilled', function(done) {
			model.findManyByOneOfTheTags('even').then(function(manyByTags) {
				manyByTags.should.have.length(2);
				manyByTags[0].toVO().should.deep.equal(articles[2].toVO());
				manyByTags[1].toVO().should.deep.equal(articles[4].toVO());
			}).then(function(error) {
				done();	
			}, function(error) { 
				done(error); 
			});	
		});

		it('to save should be fulfilled', function(done) {
			var article = model.create({
				_id: '5',
				date: "2013-03-24T05:00:00",
				slug: 'test_article_five_slug',
				tags: ['five', 'odd', 'test']
			});

			article.save().then(function() {
				return model.findOneByID('5');
			}).then(function(data) {
				data._rev.should.be.ok;
				data.toVO().should.deep.equal(article.toVO());		
			}).then(function() {
				done();
			}, function(error) {
				done(error);
			});
		});

		it('to delete should be fulfilled', function(done) {
			var article = model.create({
				_id: '5',
				date: "2013-03-24T05:00:00",
				slug: 'test_article_five_slug',
				tags: ['five', 'odd', 'test']
			});

			return article.save().then(function() {
				return model.findOneByID('5');
			}).then(function(data) {
				data._rev.should.be.ok;
				data.toVO().should.deep.equal(article.toVO());		
			}).then(function() {
				return article.delete();	
			}).then(function() {
				return model.findOneByID('5');
			}).then(null, function(error) {
				error.status_code.should.equal(404);	
			}).then(function() {
				done();
			}, function(error) {
				done(error);
			});
		});

		// clean up after beforeEach
		afterEach(function(done) {
			this.timeout(10000);
			
			var promises = [
				Q.ninvoke(db, 'get', dd._id).then( function(results) {
					return Q.ninvoke(db, 'destroy', dd._id, results[0]._rev);
				})
			];

			articles.forEach(function(e) {
				promises.push(Q.ninvoke(e, 'delete'));
			});

			Q.all(promises).then(
				function() { done(); }, 
				function(error) { done(error); }
			);
		});
	});

	afterEach(function(done) {
		nano.db.destroy(COUCHDB_DB_NAME, function(error) {
			if (error) throw error;
			done();
		});
	});
});

