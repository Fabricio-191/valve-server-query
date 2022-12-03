/* eslint-disable @typescript-eslint/brace-style */
const FLAGS = {
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
	notPasswordProtected: '\\password\\0',
} as const;
type Flag = keyof typeof FLAGS;

export default class Filter{
	private readonly filters: string[] = [];

	private _add(key: string, value: unknown): this {
		if(typeof value !== 'string') throw new Error('value must be a string');
		this.filters.push(`${key}${value}`);

		return this;
	}

	public hasTags(tags: string[]): this {
		if(!Array.isArray(tags)) throw new Error('value must be an array');
		this.filters.push(`\\gametype\\${tags.join(',')}`);

		return this;
	}

	public hasTagsL4D2(tags: string[]): this {
		if(!Array.isArray(tags)) throw new Error('value must be an array');
		this.filters.push(`\\gamedata\\${tags.join(',')}`);

		return this;
	}

	public hasAnyTagsL4F2(tags: string[]): this {
		if(!Array.isArray(tags)) throw new Error('value must be an array');
		this.filters.push(`\\gamedataor\\${tags.join(',')}`);

		return this;
	}

	public map(map: string): this { return this._add('\\map\\', map); }
	public mod(mod: string): this { return this._add('\\gamedir\\', mod); }
	public address(address: string): this { return this._add('\\gameaddr\\', address); }
	public nameMatch(name: string): this { return this._add('\\name_match\\', name); }
	public versionMatch(version: string): this { return this._add('\\version_match\\', version); }

	public notAppId(appId: number): this {
		if(!Number.isInteger(appId)) throw new Error('value must be a number');

		this.filters.push(`\\napp\\${appId}`);
		return this;
	}

	public appId(appId: number): this {
		if(!Number.isInteger(appId)) throw new Error('value must be a number');

		this.filters.push(`\\appid\\${appId}`);
		return this;
	}

	public is(...flags: Flag[]): this {
		for(const flag of flags){
			if(!(flag in FLAGS)) throw new Error('invalid flag');
			this.filters.push(FLAGS[flag]);
		}

		return this;
	}

	public addNOR(filter: Filter): this {
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		this.filters.push(
			`\\nor\\${filter.filters.length}`,
			...filter.filters
		);
		return this;
	}

	public addNAND(filter: Filter): this {
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		this.filters.push(
			`\\nand\\${filter.filters.length}`,
			...filter.filters
		);

		return this;
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
	.address('111.111.111.111') // port supported too
	.nameMatch('my server *') // (can use * as a wildcard)
	.versionMatch('4.*') // (can use * as a wildcard)
	.appId(240) // (240 is the appid for L4D2)
	.hasPassword()
	.is('dedicated', 'not_proxy', 'not_whitelisted', 'not_full')
	.is('secure')
*/