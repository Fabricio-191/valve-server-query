"use strict";
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
/* eslint-disable @typescript-eslint/brace-style */
var FLAGS = {
    dedicated: '\\dedicated\\1',
    not_dedicated: '\\nand\\1\\dedicated\\1',
    secure: '\\secure\\1',
    not_secure: '\\nand\\1\\secure\\1',
    linux: '\\linux\\1',
    not_linux: '\\nand\\1\\linux\\1',
    empty: '\\noplayers\\1',
    not_empty: '\\empty\\1',
    full: '\\nand\\1\\full\\1',
    not_full: '\\full\\1',
    whitelisted: '\\nand\\1\\white\\1',
    not_whitelisted: '\\white\\1',
    proxy: '\\proxy\\1',
    not_proxy: '\\nand\\1\\proxy\\1',
    passwordProtected: '\\nand\\1\\password\\0',
    notPasswordProtected: '\\password\\0'
};
var Filter = /** @class */ (function () {
    function Filter() {
        this.filters = [];
    }
    Filter.prototype._add = function (key, value) {
        if (typeof value !== 'string')
            throw new Error('value must be a string');
        this.filters.push("".concat(key).concat(value));
        return this;
    };
    Filter.prototype.hasTags = function (tags) {
        if (!Array.isArray(tags))
            throw new Error('value must be an array');
        this.filters.push("\\gametype\\".concat(tags.join(',')));
        return this;
    };
    Filter.prototype.hasTagsL4D2 = function (tags) {
        if (!Array.isArray(tags))
            throw new Error('value must be an array');
        this.filters.push("\\gamedata\\".concat(tags.join(',')));
        return this;
    };
    Filter.prototype.hasAnyTagsL4F2 = function (tags) {
        if (!Array.isArray(tags))
            throw new Error('value must be an array');
        this.filters.push("\\gamedataor\\".concat(tags.join(',')));
        return this;
    };
    Filter.prototype.map = function (map) { return this._add('\\map\\', map); };
    Filter.prototype.mod = function (mod) { return this._add('\\gamedir\\', mod); };
    Filter.prototype.address = function (address) { return this._add('\\gameaddr\\', address); };
    Filter.prototype.nameMatch = function (name) { return this._add('\\name_match\\', name); };
    Filter.prototype.versionMatch = function (version) { return this._add('\\version_match\\', version); };
    Filter.prototype.notAppId = function (appId) {
        if (!Number.isInteger(appId))
            throw new Error('value must be a number');
        this.filters.push("\\napp\\".concat(appId));
        return this;
    };
    Filter.prototype.appId = function (appId) {
        if (!Number.isInteger(appId))
            throw new Error('value must be a number');
        this.filters.push("\\appid\\".concat(appId));
        return this;
    };
    Filter.prototype.is = function () {
        var flags = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            flags[_i] = arguments[_i];
        }
        for (var _a = 0, flags_1 = flags; _a < flags_1.length; _a++) {
            var flag = flags_1[_a];
            if (!(flag in FLAGS))
                throw new Error('invalid flag');
            this.filters.push(FLAGS[flag]);
        }
        return this;
    };
    Filter.prototype.addNOR = function (filter) {
        var _a;
        if (!(filter instanceof Filter)) {
            throw new Error('filter must be an instance of MasterServer.Filter');
        }
        (_a = this.filters).push.apply(_a, __spreadArray(["\\nor\\".concat(filter.filters.length)], filter.filters, false));
        return this;
    };
    Filter.prototype.addNAND = function (filter) {
        var _a;
        if (!(filter instanceof Filter)) {
            throw new Error('filter must be an instance of MasterServer.Filter');
        }
        (_a = this.filters).push.apply(_a, __spreadArray(["\\nand\\".concat(filter.filters.length)], filter.filters, false));
        return this;
    };
    Filter.prototype.toString = function () {
        return this.filters.join('');
    };
    return Filter;
}());
exports["default"] = Filter;
/*
new MasterServer.Filter()
    .hasTags(['coop', 'versus'])
    .map('c1m1_hotel')
    .mod('l4d2')
    .address('111.111.111.111') // port supported too
    .nameMatch('my server *') // (can use * as a wildcard)
    .versionMatch('4.*') // (can use * as a wildcard)
    .appId(240) // (240 is the appid for L4D2)
    .hasPassword()
    .is('dedicated', 'not_proxy', 'not_whitelisted', 'not_full')
    .is('secure')
*/ 
