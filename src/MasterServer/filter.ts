export default class Filter{
	private readonly filters: string[] = [];

	private _add1(key: string, value: string[]): this {
		if(!Array.isArray(value)) throw new Error('value must be an array');
		this.filters.push(`${key}${value.join(',')}`);
		return this;
	}

	private _add2(key: string, value: string): this {
		if(typeof value !== 'string') throw new Error('value must be a string');
		this.filters.push(`${key}${value}`);
		return this;
	}

	private _add3(key: string, value: number): this {
		if(typeof value !== 'number' || isNaN(value) || !Number.isFinite(value) || !Number.isInteger(value)){
			throw new Error('value must be a number');
		}
		this.filters.push(`${key}${value}`);
		return this;
	}

	private _add4(value: string): this {
		this.filters.push(value);
		return this;
	}

	public tags(tags: string[]): this {
		return this._add1('\\gametype\\', tags);
	}

	public tagsL4D2(tags: string[]): this {
		return this._add1('\\gamedata\\', tags);
	}

	public someTagsL4F2(tags: string[]): this {
		return this._add1('\\gamedataor\\', tags);
	}

	public map(map: string): this {
		return this._add2('\\map\\', map);
	}

	public mod(mod: string): this {
		return this._add2('\\gamedir\\', mod);
	}

	public address(address: string): this {
		return this._add2('\\gameaddr\\', address);
	}

	public nameMatch(name: string): this {
		return this._add2('\\name_match\\', name);
	}

	public versionMatch(version: string): this {
		return this._add2('\\version_match\\', version);
	}

	public notAppId(appId: number): this {
		return this._add3('\\napp\\', appId);
	}

	public appId(appId: number): this {
		return this._add3('\\appid\\', appId);
	}

	public isDedicated(): this {
		return this._add4('\\dedicated\\1');
	}

	public isNotDedicated(): this {
		return this._add4('\\nand\\1\\dedicated\\1');
	}

	public isSecure(): this {
		return this._add4('\\secure\\1');
	}

	public isNotSecure(): this {
		return this._add4('\\nand\\1\\secure\\1');
	}

	public isLinux(): this {
		return this._add4('\\linux\\1');
	}

	public isNotLinux(): this {
		return this._add4('\\nand\\1\\linux\\1');
	}

	public isEmpty(): this {
		return this._add4('\\noplayers\\1');
	}

	public isNotEmpty(): this {
		return this._add4('\\empty\\1');
	}

	public isNotFull(): this {
		return this._add4('\\full\\1');
	}

	public isFull(): this {
		return this._add4('\\nand\\1\\full\\1');
	}

	public hasPassword(): this {
		return this._add4('\\nand\\password\\0');
	}

	public hasNoPassword(): this {
		return this._add4('\\password\\0');
	}

	public whitelisted(): this {
		return this._add4('\\white\\1');
	}

	public notWhitelisted(): this {
		return this._add4('\\nand\\1\\white\\1');
	}

	public isProxy(): this {
		return this._add4('\\proxy\\1');
	}

	public isNotProxy(): this {
		return this._add4('\\nand\\1\\proxy\\1');
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
