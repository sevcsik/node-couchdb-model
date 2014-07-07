![NPM Version](http://img.shields.io/npm/v/couchdb-model.svg?style=flat)
![NPM Downloads](http://img.shields.io/npm/dm/couchdb-model.svg?style=flat)

# couchdb-model

A simple CouchDB abstraction for NodeJS built on [nano](https://github.com/dscape/nano).

## Installation
`npm install couchdb-model`

## Usage

### Creating your model

First, configure your database using nano.

``` js
var nano = require('nano')(COUCHDB_BASE_URL);
var dbHandle = nano.use(COUCHDB_DB_NAME);

```

Create your model

``` js
var couchDBModel = require('couchdb-model');
var myModel = couchDBModel(dbHandle);
```

Now, you can use `myModel` to create a new document.

``` js
var document = myModel.create({
	data: 'my_data',
	createdAt: Date.now()
});

var documentWithID = myModel.create({
	_id: 'my_unique_id',
	data: 'my_data',
	createdAt: Date.now()
});

```

You can persist the documents into the database. If no ID given, the instance
will be updated with the ID couchdb generated.
All functions and fields starting with `_` will be discarded, except 
`_id` and `_rev`.

``` js
document.save(function(error) {
	if (error) console.error('failed to save document');
	else console.log('document saved with id: ' + document._id);
});
```

To delete an document (ID will be reset to null)

``` js
document.delete(function(error) {
	if (error) console.error('failed to delete document');
	else console.log('document deleted.');
});
```

To find a document by ID:

``` js
myModel.findOneByID('my_unique_id', function(error, result) {
	if (error) console.error('failed to get the document');
	else console.log(result); // result is an model instance
});
```

To list all documents (requires admin rights, uses `_all_docs`):

``` js
myModel.findAll(function(error, results) {
	if (error) console.error('failed list documents');
	else console.log(results); // result is an array of model instances
});
```

## Error handling

If a request fails, nano's `error` parameter is just forwared to your callback.
See nano documentation for more information.

## Using your own constructor for models

You can override the constructor wich is used by `Model#create` and `Model#find` methods.
In order to keep it working, you have to extend the original constructor.

``` js
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

user.save(function(error) {
	Model.findOneByID(user._id, function(error, result) {
		console.log(result.checkPassword('pw')); // outputs true
		done();
	});
});	
```
All methods will be discarded when they are persisted to the database.

## Using views

You can specify your views when you create your model, by passing a configuration object to the model factory function. The `views` array in your options object can be just the path to the views, or an object, specifying the path and the name.

``` js
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

```

The `name` field is used to generate method names. If not given, the last segment of `path` will be used. The name will be camelized to create nice method names. 
The above example will create a model with the following methods:

* `model.findOneByDate`
* `model.findManyByDate`
* `model.findOneByOneOfTheTags`
* `model.findManyByOneOfTheTags`
* `model.findOneBySlug`
* `model.findManyBySlug`

### findMany methods

* `findMany{ViewName}(startkey, [[[[endkey], sort], limit], skip], callback)`

The above arguments are mapped to the corresponding CouchDB request parameters, except `sort`, which can be `"asc"` or `"dsc"`.

* `findMany{ViewName}(null, params, callback)`

If you provide `null` as the first argument, the second argument will be treated as a CouchDB request parameter object, and will be passed to nano. You can find out about these parameters in the [CouchDB docs](http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options).

There's no need to `JSON.stringify` and URL encode the parameters, this is taken care of behind the scenes by the wonderful nano.

`callback` is a standard node-style callback, and the second argument will be an array of instances.

### findOne methods
* `findOne{viewname}(startkey, [[[endkey], sort], skip], callback)`
* `findOne{viewname}(null, params, callback)`

They work the same way as `findMany` except that limit is always set to `1`, and the second argument to `callback` will be an instance, not an array.

## Promises
All async methods return a promise (created with [Q](https://github.com/kriskowal/q)), when there's no callback passed as the last argument.

## REST API
If enabled, the model will generate an `onRequest` method, which is a standard NodeJS request handler. The REST API can be enabled via the `restapi` field in the configuration object.

### Indexing
If indexing is enabled, GET-ting the root path will return all documents in the database (if findAll has all the required permissions).

``` js
var myModel = couchDBModel(db, {
	restapi: {
		index: true
	}
});

// GET / returns an array of all documents

```

### Querying by ID
Elements can be queried by ID by supplying an ID in the path, if it's enabled by the `byID` flag. The ID cannot contain a slash.

``` js
var myModel = couchDBModel(db, {
	restapi: {
		byID: true
	}
});

// GET /asdasd3wer will return the document with the id asdasd3wer, or 404 if not found
```

### Querying views
Views can be enabled one-by one, by setting flags in the `views` object in the configuration. The view names should match the names in the `config.views` object, in a camelcased form. In the request URLs the original view names can be used.

``` js
var myModel = couchDBModel(db, {
	views: [
		'_design/article/_view/by_date', 
		{
			path: '_design/article/_view/by_tag',
			name: 'by_one_of_the_tags'
		}, 
		{
			path: '_design/article/_view/by_slug'
		}
	],
	restapi: {
		views: {
			byOneOfTheTags: true,
			bySlug: false
		}
	}
});

// GET /by_slug/something responds 403
```

There are two URL patterns for view requests: findOne, and with params.

#### params
View URLs can be accessed the same way as CouchDB views, with a query string. The standard CouchDB parameters can be used (`startkey`, `endkey`, etc.). This pattern is mapped to a `Model#findManyBy{view}(null, {object} params, [{function} callback)]` call.
The result will be an array containing the result documents.

Example:
```
GET /by_date/?startkey=2014-01-01&endkey=2014-12-31
```

#### findOne
There's a simplified pattern which is mapped to the `Model#findOneBy{view}({string} key, [{function} callback])` call. It expects one key as a path segment, and it will respond with the first match, or 404 if there are no matches. 

Example:
``` js
GET /by_slug/a_sample_slug
```

### PUT & POST
Saving to the database can be enabled by setting the `save` flag.
``` js
var myModel = couchDBModel(db, {
	restapi: {
		save: true
	}
});
```

The request handler doesn't treat `PUT` and `POST` different. Either of them can be used to create a new document or overwrite an existing one. However, the frontend code should use `POST` for new documents and `PUT` for modifying existing ones, because the browsers treat the requests different by method.

To save/create a document, send a PUT/POST request with a JSON body to the root path.

### Error handling
Common errors are mapped to the standard HTTP status codes (403, 404, 400), with a custom reason string. If something happens between the library and the database, an `500 Database Error` response is given.

### URL prefix
You can set an URL prefix to the REST API. The given URL prefix will be stripped from the path before processing the requests.

``` js
var myModel = couchDBModel(db, {
	restapi: {
		prefix: '/api_root',
	}
});

// GET /api_root/ returns all documents
```

### Usage with express
The `onRequest` function can be used as an express request handler, but the prefix has to be passed to the model.

``` js
var myModel = couchDBModel(db, {
	restapi: {
		prefix: '/my_api'
	}
});

app.use('/my_api', myModel.onRequest);
```

## Unit tests

To run unit tests, you have to set the $COUCHDB_BASE_URL environment variable
to a working couchdb instance with administrative privileges.

By default, 'couchdb-model-test' will be deleted and created many times
during the tests. You can override the database name with $COUCHDB_DB_NAME.

``` bash
$ COUCHDB_BASE_URL="http://admin:admin@example.com:5984/" npm test
```

## TODO

* Allow to initialize a model directly with a URL instead of a database handle
* Allow custom validation functions
* ~~Promise support~~
