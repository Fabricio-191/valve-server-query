"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.__esModule = true;
exports.parseRCONOptions = exports.parseMasterServerOptions = exports.parseServerOptions = exports.REGIONS = void 0;
var utils_1 = require("./utils");
var filter_1 = require("../MasterServer/filter");
exports.REGIONS = {
    US_EAST: 0,
    US_WEST: 1,
    SOUTH_AMERICA: 2,
    EUROPE: 3,
    ASIA: 4,
    AUSTRALIA: 5,
    MIDDLE_EAST: 6,
    AFRICA: 7,
    OTHER: 0xFF
};
// #endregion
// #region options
var DEFAULT_OPTIONS = {
    ip: '127.0.0.1',
    port: 27015,
    timeout: 5000,
    debug: false,
    enableWarns: true
};
var DEFAULT_SERVER_OPTIONS = __assign(__assign({}, DEFAULT_OPTIONS), { appID: -1, multiPacketGoldSource: false, protocol: -1, info: {
        challenge: false,
        goldSource: false
    } });
var DEFAULT_MASTER_SERVER_OPTIONS = {
    ip: 'hl2master.steampowered.com',
    port: 27011,
    timeout: 5000,
    debug: false,
    enableWarns: true,
    quantity: 200,
    region: 'OTHER',
    filter: new filter_1["default"]()
};
// #endregion
function parseBaseOptions(options) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, ip, ipFormat;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (options.ip.includes(':')) {
                        _b = options.ip.split(':'), options.ip = _b[0], options.port = _b[1];
                    }
                    if (typeof options.port === 'string') {
                        options.port = parseInt(options.port);
                    }
                    if (typeof options.port !== 'number' || isNaN(options.port) ||
                        options.port < 0 || options.port > 65535) {
                        throw Error('The port to connect should be a number between 0 and 65535');
                    }
                    else if (typeof options.debug !== 'boolean') {
                        throw Error("'debug' should be a boolean");
                    }
                    else if (typeof options.enableWarns !== 'boolean') {
                        throw Error("'enableWarns' should be a boolean");
                    }
                    else if (typeof options.timeout !== 'number' || isNaN(options.timeout) || options.timeout < 0) {
                        throw Error("'timeout' should be a number greater than zero");
                    }
                    else if (typeof options.ip !== 'string') {
                        throw Error("'ip' should be a string");
                    }
                    return [4 /*yield*/, (0, utils_1.resolveHostname)(options.ip)];
                case 1:
                    _a = _c.sent(), ip = _a.ip, ipFormat = _a.ipFormat;
                    // @ts-expect-error port can't be a string
                    return [2 /*return*/, __assign(__assign({}, options), { ip: ip, ipFormat: ipFormat, address: "".concat(ip, ":").concat(options.port) })];
            }
        });
    });
}
function parseServerOptions(options) {
    if (typeof options !== 'object' || options === null)
        throw new TypeError('Options must be an object');
    if (typeof options === 'string')
        options = { ip: options };
    return parseBaseOptions(__assign(__assign({}, DEFAULT_SERVER_OPTIONS), options));
}
exports.parseServerOptions = parseServerOptions;
function parseMasterServerOptions(options) {
    return __awaiter(this, void 0, void 0, function () {
        var parsedOptions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (typeof options !== 'object' || options === null)
                        throw new TypeError('Options must be an object');
                    if (typeof options === 'string')
                        options = { ip: options };
                    return [4 /*yield*/, parseBaseOptions(__assign(__assign({}, DEFAULT_MASTER_SERVER_OPTIONS), options))];
                case 1:
                    parsedOptions = _a.sent();
                    if (parsedOptions.quantity === 'all') {
                        parsedOptions.quantity = Infinity;
                    }
                    if (typeof parsedOptions.quantity !== 'number' || isNaN(parsedOptions.quantity) || parsedOptions.quantity < 0) {
                        throw Error("'quantity' should be a number greater than zero");
                    }
                    else if (typeof parsedOptions.region !== 'string') {
                        throw Error("'region' should be a string");
                    }
                    else if (!(parsedOptions.region in exports.REGIONS)) {
                        throw Error("'region' should be one of the following: ".concat(Object.keys(exports.REGIONS).join(', ')));
                    }
                    else if (!(parsedOptions.filter instanceof filter_1["default"])) {
                        throw Error("'filter' should be an instance of Filter");
                    }
                    return [2 /*return*/, __assign(__assign({}, parsedOptions), { quantity: parsedOptions.quantity, region: exports.REGIONS[parsedOptions.region], filter: parsedOptions.filter.toString() })];
            }
        });
    });
}
exports.parseMasterServerOptions = parseMasterServerOptions;
function parseRCONOptions(options) {
    if (options === void 0) { options = null; }
    return __awaiter(this, void 0, void 0, function () {
        var parsedOptions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (typeof options !== 'object' || options === null)
                        throw new TypeError('Options must be an object');
                    if (typeof options === 'string')
                        options = { password: options };
                    return [4 /*yield*/, parseBaseOptions(__assign(__assign({}, DEFAULT_OPTIONS), options))];
                case 1:
                    parsedOptions = _a.sent();
                    if (typeof parsedOptions.password !== 'string' || parsedOptions.password === '') {
                        throw new Error('RCON password must be a non-empty string');
                    }
                    return [2 /*return*/, parsedOptions];
            }
        });
    });
}
exports.parseRCONOptions = parseRCONOptions;
