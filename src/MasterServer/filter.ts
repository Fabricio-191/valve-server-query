const flags = {
	dedicated: '\\dedicated\\1',
	secure: '\\secure\\1',
	linux: '\\linux\\1',
	empty: '\\empty\\1',
	full: '\\full\\1',
	proxy: '\\proxy\\1',
	noplayers: '\\noplayers\\1',
	white: '\\white\\1',
	collapse_addr_hash: '\\collapse_addr_hash\\1',
	password: '\\password\\0',
} as const;

type Flag = keyof typeof flags;
type FilterKey = 'appid' | 'gameaddr' | 'gamedata' | 'gamedataor' | 'gamedir' | 'gametype' | 'map' | 'name_match' | 'napp' | 'version_match';

export default class Filter{
	public readonly filters: string[] = [];

	public add(key: FilterKey, value: string[] | number | string): this {
		switch(key){
			case 'gametype':
			case 'gamedata':
			case 'gamedataor':{
				if(!Array.isArray(value)) throw new Error(`${key} must be an array`);
				this.filters.push(`\\${key}\\${value.join(',')}`);
				break;
			}
			case 'map':
			case 'gamedir':
			case 'gameaddr':
			case 'name_match':
			case 'version_match':{
				if(typeof value !== 'string') throw new Error(`${key} must be a string`);
				this.filters.push(`\\${key}\\${value}`);
				break;
			}
			case 'napp':
			case 'appid':{
				if(typeof value !== 'number' || isNaN(value) || !Number.isFinite(value)){
					throw new Error(`${key} must be a finite number`);
				}
				this.filters.push(`\\${key}\\${value}`);
				break;
			}
			default:{
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				throw new Error(`${key} is not a valid key`);
			}
		}

		return this;
	}
	public addFlag(flag: Flag): this {
		if(!(flag in flags)){
			throw new Error(`unknown flag: ${flag}`);
		}

		this.filters.push(flags[flag]);
		return this;
	}
	public addFlags(flagsArr: Flag[]): this {
		for(const flag of flagsArr){
			this.addFlag(flag);
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
}
