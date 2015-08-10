var stream = require('readable-stream');
var inherits = require('inherits');

function FlatStream(opts) {
    this.transform = opts.transform || null;
}
FlatStream.prototype.getBody = function () {
    var buffers = [];
    for (var i = 0; i < this.chunks.length; i++) {
        buffers.push(Buffer.isBuffer(this.chunks[i]) ? this.chunks[i] : Buffer(this.chunks[i]));
    }
    var body = Buffer.concat(buffers);
    if (this.transform) {
        body = this.transform(body);
    }
    return body;
};
FlatStream.prototype.isFlatStream = true;

function inheritsFlatStream(Stream) {
    for (var key in FlatStream.prototype) {
        if (FlatStream.prototype.hasOwnProperty(key)) {
            Stream.prototype[key] = FlatStream.prototype[key]
        }
    }
}

function WritableFlatStream(opts, cb) {
    stream.Writable.call(this);
    FlatStream.call(this, opts);
    this.chunks = [];
    this.on('finish', function () {
        cb(this.getBody());
    });
}
inherits(WritableFlatStream, stream.Writable);
inheritsFlatStream(WritableFlatStream);
WritableFlatStream.prototype._write = function (chunk, enc, next) {
    this.chunks.push(chunk);
    next();
};

function ReadableFlatStream(opts, data) {
    stream.Readable.call(this);
    FlatStream.call(this, opts);
    this.chunks = data instanceof Array ? data : [data];
}
inherits(ReadableFlatStream, stream.Readable);
inheritsFlatStream(ReadableFlatStream);
ReadableFlatStream.prototype._read = function () {
    this.push(this.getBody());
    this.push(null);
};

function DuplexFlatStream(opts) {
    stream.Duplex.call(this);
    FlatStream.call(this, opts);
    this.chunks = [];
    this.on('finish', function () {
        ReadableFlatStream.prototype._read.call(this);
    });
}
inherits(DuplexFlatStream, stream.Duplex);
inheritsFlatStream(DuplexFlatStream);
DuplexFlatStream.prototype._write = WritableFlatStream.prototype._write;
DuplexFlatStream.prototype._read = function () {
};

function flatStream() {
    var opts = (typeof arguments[0] == 'object') && (arguments[0].constructor == Object) && arguments[0];
    var arg = arguments[opts ? 1 : 0];
    opts = opts || {};
    if (typeof arg == 'undefined') return new DuplexFlatStream(opts);
    if (typeof arg == 'function') return new WritableFlatStream(opts, arg);
    return new ReadableFlatStream(opts, arg);
}
inherits(flatStream, DuplexFlatStream);

// individual stream-type constructors exposed for (a) extending, and (b) use with `instanceof`
flatStream.Writable = WritableFlatStream;
flatStream.Readable = ReadableFlatStream;
flatStream.Duplex = DuplexFlatStream;

module.exports = flatStream;
