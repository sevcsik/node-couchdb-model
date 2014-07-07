var couchDBModel = require('../../lib/couchdb-model.js');
var nano = require('nano');
var http = require('http');
var Q = require('q');

var HOST = process.env.HOST || '127.0.0.1';
var PORT = process.env.PORT || '8080';
var COUCHDB_BASE_URL = process.env.COUCHDB_BASE_URL || 'http://localhost:5984';
var COUCHDB_DB_NAME = process.env.COUCHDB_DB_NAME || 'couchdb_model_demo';

console.log('Configuration (change them with environment variables): ');
console.log('\tHOST: \t\t\t', HOST);
console.log('\tPORT: \t\t\t', PORT);
console.log('\tCOUCHDB_BASE_URL: \t', COUCHDB_BASE_URL);
console.log('\tCOUCHDB_DB_NAME: \t', COUCHDB_DB_NAME);

nano = nano(COUCHDB_BASE_URL);

if (!COUCHDB_BASE_URL) {
	throw new Error('Environment variable COUCHDB_BASE_URL is not set!');
}

var server;

console.log('Destroying database ' + COUCHDB_DB_NAME);
Q.ninvoke(nano.db, 'destroy', COUCHDB_DB_NAME).
	then(function() {}, function() {}).
	then(function() {

	console.log('Creating database ' + COUCHDB_DB_NAME);
	return Q.ninvoke(nano.db, 'create', COUCHDB_DB_NAME);
}).then(function() {
	var model = new couchDBModel(nano.use(COUCHDB_DB_NAME), {
		restapi: {
			index: true,
			byID: true,
			save: true
		}			
	});

	console.log('Bound REST API to request event');
	server.on('request', model.onRequest);

}, function(error) {
	console.error(error);
});

process.on('SIGTERM', function() {
	console.log('Destroying database ' + COCUDB_DB_NAME);
	nano.db.destroy(COUCHDB_DB_NAME, function(error) {
		if (error) {
			throw error;
		}

		server.close();
		console.log('Bye.');
	});
});

server = http.createServer();
server.listen(+PORT, HOST);
