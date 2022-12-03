const flags = {
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
} as const;
type Flag = keyof typeof flags;

export default class Filter{
	private readonly filters: string[] = [];

	private _add(key: string, type: unknown, value: unknown = null): this {
		// eslint-disable-next-line default-case
		switch(type){
			case null:
				this.filters.push(value as string);
				break;
			case 'array':
				if(!Array.isArray(value)) throw new Error('value must be an array');
				this.filters.push(`${key}${value.join(',')}`);
				break;
			case 'string':
				if(typeof value !== 'string') throw new Error('value must be a string');
				this.filters.push(`${key}${value}`);
				break;
			case 'number':
				if(typeof value !== 'number' || isNaN(value) || !Number.isFinite(value) || !Number.isInteger(value)){
					throw new Error('value must be a number');
				}
				this.filters.push(`${key}${value}`);
				break;
		}

		return this;
	}

	public hasTags(tags: string[]): this {
		return this._add('\\gametype\\', 'array', tags);
	}

	public hasTagsL4D2(tags: string[]): this {
		return this._add('\\gamedata\\', 'array', tags);
	}

	public hasSomeTagsL4F2(tags: string[]): this {
		return this._add('\\gamedataor\\', 'array', tags);
	}

	public map(map: string): this {
		return this._add('\\map\\', 'string', map);
	}

	public mod(mod: string): this {
		return this._add('\\gamedir\\', 'string', mod);
	}

	public address(address: string): this {
		return this._add('\\gameaddr\\', 'string', address);
	}

	public nameMatch(name: string): this {
		return this._add('\\name_match\\', 'string', name);
	}

	public versionMatch(version: string): this {
		return this._add('\\version_match\\', 'string', version);
	}

	public notAppId(appId: number): this {
		return this._add('\\napp\\', 'number', appId);
	}

	public appId(appId: number): this {
		return this._add('\\appid\\', 'number', appId);
	}

	public is(flag: Flag): this {
		if(!(flag in flags)) throw new Error('invalid flag');

		return this._add(flags[flag], null);
	}

	public hasPassword(): this {
		return this._add('\\nand\\password\\0', null);
	}

	public hasNoPassword(): this {
		return this._add('\\password\\0', null);
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
