"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.debug = exports.BufferReader = exports.BufferWriter = exports.resolveHostname = void 0;
var dns_1 = require("dns");
function resolveHostname(string) {
    return __awaiter(this, void 0, void 0, function () {
        var r, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, dns_1.promises.lookup(string, { verbatim: false })];
                case 1:
                    r = _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    throw Error("'ip' is not a valid IP address or hostname");
                case 3:
                    if (r.family !== 4 && r.family !== 6) {
                        throw Error('');
                    }
                    return [2 /*return*/, {
                            ipFormat: r.family,
                            ip: r.address
                        }];
            }
        });
    });
}
exports.resolveHostname = resolveHostname;
var BufferWriter = /** @class */ (function () {
    function BufferWriter() {
        this.buffer = [];
    }
    BufferWriter.prototype.string = function (value, encoding) {
        if (encoding === void 0) { encoding = 'ascii'; }
        return this.byte.apply(this, __spreadArray(__spreadArray([], Buffer.from(value, encoding), false), [0], false));
    };
    BufferWriter.prototype.byte = function () {
        var _a;
        var values = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            values[_i] = arguments[_i];
        }
        (_a = this.buffer).push.apply(_a, values);
        return this;
    };
    BufferWriter.prototype.long = function (number) {
        var buf = Buffer.alloc(4);
        buf.writeInt32LE(number);
        return this.byte.apply(this, buf);
    };
    BufferWriter.prototype.end = function () {
        return Buffer.from(this.buffer);
    };
    return BufferWriter;
}());
exports.BufferWriter = BufferWriter;
var BufferReader = /** @class */ (function () {
    function BufferReader(buffer, offset) {
        if (offset === void 0) { offset = 0; }
        this.offset = 0;
        this.length = buffer.length;
        this.buffer = buffer;
        this.offset = offset;
    }
    BufferReader.prototype.byte = function () {
        return this.buffer.readUInt8(this.offset++);
    };
    BufferReader.prototype.short = function (unsigned, endianess) {
        if (unsigned === void 0) { unsigned = false; }
        if (endianess === void 0) { endianess = 'LE'; }
        this.offset += 2;
        return this.buffer["read".concat(unsigned ? 'U' : '', "Int16").concat(endianess)](this.offset - 2);
    };
    BufferReader.prototype.long = function () {
        this.offset += 4;
        return this.buffer.readInt32LE(this.offset - 4);
    };
    BufferReader.prototype.float = function () {
        this.offset += 4;
        return this.buffer.readFloatLE(this.offset - 4);
    };
    BufferReader.prototype.bigUInt = function () {
        this.offset += 8;
        return this.buffer.readBigUInt64LE(this.offset - 8);
    };
    BufferReader.prototype.string = function (encoding) {
        if (encoding === void 0) { encoding = 'ascii'; }
        var stringEndIndex = this.buffer.indexOf(0, this.offset);
        if (stringEndIndex === -1)
            throw new Error('string not terminated');
        var string = this.buffer
            .slice(this.offset, stringEndIndex)
            .toString(encoding);
        this.offset = stringEndIndex + 1;
        return string;
    };
    BufferReader.prototype.char = function () {
        return this.buffer.slice(this.offset++, this.offset).toString();
    };
    BufferReader.prototype.addOffset = function (offset) {
        this.offset += offset;
        return this;
    };
    Object.defineProperty(BufferReader.prototype, "hasRemaining", {
        get: function () {
            return this.offset < this.length;
        },
        enumerable: false,
        configurable: true
    });
    BufferReader.prototype.remaining = function () {
        return this.buffer.slice(this.offset);
    };
    return BufferReader;
}());
exports.BufferReader = BufferReader;
function debug(string, buffer) {
    if (buffer) {
        var parts = Buffer.from(buffer)
            .toString('hex')
            .match(/../g);
        var str = "<Buffer ".concat(buffer.length > 300 ?
            "".concat(parts.slice(0, 20).join(' '), " ...").concat(buffer.length - 20, " bytes") :
            parts.join(' '), ">").replace(/(?<!00 )00 00(?! 00)/g, '\x1B[31m00 00\x1B[00m');
        // eslint-disable-next-line no-console
        console.log("\u001B[33m".concat(string, "\u001B[0m"), str, '\n');
    }
    else {
        // eslint-disable-next-line no-console
        console.log("\u001B[33m".concat(string, "\u001B[0m"), '\n');
    }
}
exports.debug = debug;
