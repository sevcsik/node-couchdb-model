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
* Promise support
