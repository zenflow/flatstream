var flat = require('../');
var test = require('tape');
var stream = require('readable-stream');

test('writable', function (t) {
    t.plan(4);
    var writable = flat(function (data) {
        t.equal(data.toString('utf8'), 'foobar')
    });
    t.ok(writable instanceof stream.Writable);
    t.ok(writable instanceof flat.Writable);
    t.ok(writable.isFlatStream);
    writable.write('foo');
    writable.end('bar');
});

test('readable', function (t) {
    t.plan(4);
    var readable = flat(['foo', 'bar']);
    t.ok(readable instanceof stream.Readable);
    t.ok(readable instanceof flat.Readable);
    t.ok(readable.isFlatStream);
    readable.once('data', function (data) {
        t.equal(data.toString('utf8'), 'foobar');
    });
});

test('duplex', function (t) {
    t.plan(4);
    var duplex = flat();
    t.ok(duplex instanceof stream.Duplex);
    t.ok(duplex instanceof flat.Duplex);
    t.ok(duplex.isFlatStream);
    duplex.once('data', function (data) {
        t.equal(data.toString('utf8'), 'foobar')
    });
    duplex.write('foo');
    duplex.end('bar');
});

var dummy_transform = function (source) {
    return source.toString('utf8').replace(/^upstream$/, 'downstream');
};

test('duplex /w transform', function (t) {
    t.plan(1);
    var duplex = flat({transform: dummy_transform});
    duplex.once('data', function (data) {
        t.equal(data.toString('utf8'), 'downstream');
    });
    duplex.write('up');
    duplex.end('stream');
});

test('writable /w transform', function (t) {
    t.plan(1);
    var writable = flat({transform: dummy_transform}, function (data) {
        t.equal(data.toString('utf8'), 'downstream');
    });
    writable.write('up');
    writable.end('stream');
});

test('readable /w transform', function (t) {
    t.plan(1);
    var readable = flat({transform: dummy_transform}, ['up', 'stream']);
    readable.once('data', function (data) {
        t.equal(data.toString('utf8'), 'downstream');
    });
});