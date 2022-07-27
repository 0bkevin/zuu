// source: service.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!

goog.provide('proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter');

goog.require('jspb.BinaryReader');
goog.require('jspb.BinaryWriter');
goog.require('jspb.Message');
goog.require('proto.cash.z.wallet.sdk.rpc.BlockRange');

/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.displayName = 'proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter';
}



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.prototype.toObject = function(opt_includeInstance) {
  return proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.toObject = function(includeInstance, msg) {
  var f, obj = {
    address: jspb.Message.getFieldWithDefault(msg, 1, ""),
    range: (f = msg.getRange()) && proto.cash.z.wallet.sdk.rpc.BlockRange.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter}
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter;
  return proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter}
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setAddress(value);
      break;
    case 2:
      var value = new proto.cash.z.wallet.sdk.rpc.BlockRange;
      reader.readMessage(value,proto.cash.z.wallet.sdk.rpc.BlockRange.deserializeBinaryFromReader);
      msg.setRange(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getAddress();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getRange();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      proto.cash.z.wallet.sdk.rpc.BlockRange.serializeBinaryToWriter
    );
  }
};


/**
 * optional string address = 1;
 * @return {string}
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.prototype.getAddress = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter} returns this
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.prototype.setAddress = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional BlockRange range = 2;
 * @return {?proto.cash.z.wallet.sdk.rpc.BlockRange}
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.prototype.getRange = function() {
  return /** @type{?proto.cash.z.wallet.sdk.rpc.BlockRange} */ (
    jspb.Message.getWrapperField(this, proto.cash.z.wallet.sdk.rpc.BlockRange, 2));
};


/**
 * @param {?proto.cash.z.wallet.sdk.rpc.BlockRange|undefined} value
 * @return {!proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter} returns this
*/
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.prototype.setRange = function(value) {
  return jspb.Message.setWrapperField(this, 2, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter} returns this
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.prototype.clearRange = function() {
  return this.setRange(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.cash.z.wallet.sdk.rpc.TransparentAddressBlockFilter.prototype.hasRange = function() {
  return jspb.Message.getField(this, 2) != null;
};


