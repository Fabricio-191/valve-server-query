const FLAGS = {
	full: '\\nand\\1\\full\\1',
	secure: '\\secure\\1',
	linux: '\\linux\\1',
	empty: '\\noplayers\\1',
	proxy: '\\proxy\\1',
	dedicated: '\\dedicated\\1',
	whitelisted: '\\nand\\1\\white\\1',
	password_protected: '\\nand\\1\\password\\0',

	not_full: '\\full\\1',
	not_secure: '\\nand\\1\\secure\\1',
	not_linux: '\\nand\\1\\linux\\1',
	not_empty: '\\empty\\1',
	not_proxy: '\\nand\\1\\proxy\\1',
	not_dedicated: '\\nand\\1\\dedicated\\1',
	not_whitelisted: '\\white\\1',
	not_password_protected: '\\password\\0',
} as const;

const checkNum = (num: number): string => {
	if(!Number.isInteger(num)) throw new Error('value must be an integer');
	if(num < 0) throw new Error('value must be a positive integer');
	return num.toString();
};

export default class Filter{
	private readonly filters: string[] = [];

	private _add(key: string, value: string): this {
		if(typeof value !== 'string') throw new Error('value must be a string');
		this.filters.push(`${key}${value}`);

		return this;
	}

	private _addArr(key: string, arr: string[]): this {
		if(!Array.isArray(arr) || arr.some(item => typeof item !== 'string')){
			throw new Error('value must be an array of strings');
		}
		this.filters.push(`${key}${arr.join(',')}`);

		return this;
	}

	/* eslint-disable */
	public hasTags          (   tags: string[]): this { return this._addArr('\\gametype\\',                  tags); }
	public hasTagsL4D2      (   tags: string[]): this { return this._addArr('\\gamedata\\',                  tags); }
	public hasAnyTagsL4F2   (   tags: string[]): this { return this._addArr('\\gamedataor\\',                tags); }
	public map              (    map: string  ): this { return this._add   ('\\map\\',                        map); }
	public mod              (    mod: string  ): this { return this._add   ('\\gamedir\\',                    mod); }
	public address          (address: string  ): this { return this._add   ('\\gameaddr\\',               address); }
	public name             (   name: string  ): this { return this._add   ('\\name_match\\',                name); }
	public version          (version: string  ): this { return this._add   ('\\version_match\\',          version); }
	public notMap           (    map: string  ): this { return this._add   ('\\nand\\1\\map\\',               map); }
	public notMod           (    mod: string  ): this { return this._add   ('\\nand\\1\\gamedir\\',           mod); }
	public notAddress       (address: string  ): this { return this._add   ('\\nand\\1\\gameaddr\\',      address); }
	public notName          (   name: string  ): this { return this._add   ('\\nand\\1\\name_match\\',       name); }
	public notVersion       (version: string  ): this { return this._add   ('\\nand\\1\\version_match\\', version); }
	public appId            (  appId: number  ): this { return this._add   ('\\appid\\',          checkNum(appId)); }
	public notAppId         (  appId: number  ): this { return this._add   ('\\nappid\\',         checkNum(appId)); }
	/* eslint-enable */

	public addresses(...addresses: string[]): this {
		const f = new Filter();
		for(const address of addresses) f.address(address);

		return this.any(f);
	}

	public appIds(...appIds: number[]): this {
		const f = new Filter();
		for(const appId of appIds) f.appId(appId);

		return this.any(f);
	}

	public is(...flags: Array<keyof typeof FLAGS>): this {
		for(const flag of flags){
			if(!(flag in FLAGS)) throw new Error(`invalid flag: ${flag}`);
			this.filters.push(FLAGS[flag]);
		}

		return this;
	}

	public nor(filter: Filter): this {
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		this.filters.push(`\\nor\\${filter.filters.length}`, ...filter.filters);
		return this;
	}

	public nand(filter: Filter): this {
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		this.filters.push(`\\nand\\${filter.filters.length}`, ...filter.filters);

		return this;
	}

	public any(filter: Filter): this {
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		return this.nand(new Filter().nor(filter));
	}

	public toString(): string {
		return this.filters.join('');
	}
}

/*
new MasterServer.Filter()
	.hasTags(['coop', 'versus'])
	.map('c1m1_hotel')
	.mod('l4d2')
	.address('111.111.111.111:27015') // port is optional
	.nameMatch('my server *') // (can use * as a wildcard)
	.versionMatch('4.*') // (can use * as a wildcard)
	.appId(240) // (240 is the appid for left 4 dead 2)
	.is('dedicated', 'not_proxy', 'not_whitelisted', 'not_full')
	.is('secure', 'password_protected')
*/
