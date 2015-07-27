var stream = require('readable-stream')
var inherits = require('inherits')

if (typeof Uint8Array === 'undefined') {
  var U8 = require('typedarray').Uint8Array
} else {
  var U8 = Uint8Array
}

function FlatStream(opts) {
  var encoding = opts.encoding
  var shouldInferEncoding = false
  if (!encoding) {
    shouldInferEncoding = true
  } else {
    encoding =  String(encoding).toLowerCase()
    if (encoding === 'u8' || encoding === 'uint8') {
      encoding = 'uint8array'
    }
  }
  this.encoding = encoding
  this.shouldInferEncoding = shouldInferEncoding
  this.transform = opts.transform || function (data) {return data}
}

FlatStream.prototype.inferEncoding = function (buff) {
  var firstBuffer = buff === undefined ? this.body[0] : buff;
  if (Buffer.isBuffer(firstBuffer)) return 'buffer'
  if (typeof Uint8Array !== 'undefined' && firstBuffer instanceof Uint8Array) return 'uint8array'
  if (Array.isArray(firstBuffer)) return 'array'
  if (typeof firstBuffer === 'string') return 'string'
  if (Object.prototype.toString.call(firstBuffer) === "[object Object]") return 'object'
  return 'buffer'
}

FlatStream.prototype.getBody = function () {
  if (!this.encoding && this.body.length === 0) return []
  if (this.shouldInferEncoding) this.encoding = this.inferEncoding()
  var body = this.body
  if (this.encoding === 'array') body = arrayConcat(body)
  if (this.encoding === 'string') body = stringConcat(body)
  if (this.encoding === 'buffer') body = bufferConcat(body)
  if (this.encoding === 'uint8array') body = u8Concat(body)
  return this.transform(body)
}

FlatStream.prototype.isConcatStream = true

function inheritsFlatStream (Stream) {
  for (var key in FlatStream.prototype) {
    if (FlatStream.prototype.hasOwnProperty(key)){
      Stream.prototype[key] = FlatStream.prototype[key]
    }
  }
}

function WritableFlatStream (opts, cb) {
  stream.Writable.call(this, { objectMode: true })
  FlatStream.call(this, opts)
  this.body = []
  this.on('finish', function () {
    cb(this.getBody())
  })
}
inherits(WritableFlatStream, stream.Writable)
inheritsFlatStream(WritableFlatStream)
WritableFlatStream.prototype._write = function(chunk, enc, next) {
  this.body.push(chunk)
  next()
}

function ReadableFlatStream (opts, data) {
  stream.Readable.call(this, { objectMode: true })
  FlatStream.call(this, opts)
  this.body = data instanceof Array ? data : [data]
}
inherits(ReadableFlatStream, stream.Readable)
inheritsFlatStream(ReadableFlatStream)
ReadableFlatStream.prototype._read = function () {
  this.push(this.getBody())
  this.push(null)
}

function DuplexConcatStream (opts) {
  stream.Duplex.call(this, { readableObjectMode: true, writableObjectMode: true })
  FlatStream.call(this, opts)
  this.body = []
  this.on('finish', function () {
    ReadableFlatStream.prototype._read.call(this)
  })
}
inherits(DuplexConcatStream, stream.Duplex)
inheritsFlatStream(DuplexConcatStream)
DuplexConcatStream.prototype._write = WritableFlatStream.prototype._write
DuplexConcatStream.prototype._read = function () {}

var isArray = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]'
}

function isArrayish (arr) {
  return /Array\]$/.test(Object.prototype.toString.call(arr))
}

function stringConcat (parts) {
  var strings = []
  var needsToString = false
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]
    if (typeof p === 'string') {
      strings.push(p)
    } else if (Buffer.isBuffer(p)) {
      strings.push(p)
    } else {
      strings.push(Buffer(p))
    }
  }
  if (Buffer.isBuffer(parts[0])) {
    strings = Buffer.concat(strings)
    strings = strings.toString('utf8')
  } else {
    strings = strings.join('')
  }
  return strings
}

function bufferConcat (parts) {
  var bufs = []
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]
    if (Buffer.isBuffer(p)) {
      bufs.push(p)
    } else if (typeof p === 'string' || isArrayish(p)
    || (p && typeof p.subarray === 'function')) {
      bufs.push(Buffer(p))
    } else bufs.push(Buffer(String(p)))
  }
  return Buffer.concat(bufs)
}

function arrayConcat (parts) {
  var res = []
  for (var i = 0; i < parts.length; i++) {
    res.push.apply(res, parts[i])
  }
  return res
}

function u8Concat (parts) {
  var len = 0
  for (var i = 0; i < parts.length; i++) {
    if (typeof parts[i] === 'string') {
      parts[i] = Buffer(parts[i])
    }
    len += parts[i].length
  }
  var u8 = new U8(len)
  for (var i = 0, offset = 0; i < parts.length; i++) {
    var part = parts[i]
    for (var j = 0; j < part.length; j++) {
      u8[offset++] = part[j]
    }
  }
  return u8
}

function flattenStream () {
  var opts = (typeof arguments[0] == 'object') && (arguments[0].constructor == Object) && arguments[0]
  var arg = arguments[opts ? 1 : 0]
  opts = opts || {}
  if (this instanceof flattenStream) return DuplexConcatStream.call(this, opts)
  if (typeof arg == 'undefined') return new DuplexConcatStream(opts)
  if (typeof arg == 'function') return new WritableFlatStream(opts, arg)
  return new ReadableFlatStream(opts, arg)
}
inherits(flattenStream, DuplexConcatStream)

module.exports = flattenStream
