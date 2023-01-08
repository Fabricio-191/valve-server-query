/* eslint-disable @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/explicit-function-return-type */

// https://steamcommunity.com/dev/apikey
// https://partner.steamgames.com/doc/webapi/ISteamApps#GetServerList
// https://steamapi.xpaw.me/#IGameServersService/GetServerList

import Filter from './filter';
import { optionalImport } from '../Base/utils';
import type Axios from 'axios';

const axios = optionalImport<typeof Axios>('axios');

async function get(url: URL): Promise<unknown> {
	if(!axios) throw new Error('axios not installed');
	const res = await axios.get(url.toString());
	if(res.status !== 200) throw new Error(`HTTP ${res.status} ${res.statusText}`);

	return res.data as unknown;
}

interface Response<T> {
	response: {
		success: false;
		message: string;
	} | (T & {
		success: true;
	});
}

interface serverData {
	addr: string;
	gameport: number;
	steamid: string;
	name: string;
	appid: number;
	gamedir: string;
	version: string;
	product: string;
	region: number;
	players: number;
	max_players: number;
	bots: number;
	map: string;
	secure: boolean;
	dedicated: boolean;
	os: string;
	gametype: string;
}

class WebApi {
	constructor(key: string){
		this.key = key;
	}
	private readonly key: string;

	public async getServerList(filter: Filter | number = new Filter(), limit = 100) {
		const url = new URL('https://api.steampowered.com/IGameServersService/GetServerList/v1/');
		url.searchParams.set('key', this.key);
		url.searchParams.set('limit', limit.toString());

		if(filter instanceof Filter && !filter.isEmpty){
			url.searchParams.set('filter', filter.toString());
		}else if(Number.isInteger(filter)){
			limit = filter as number;
		}

		const data = await get(url) as Response<{ servers: string[] }>;
		if(!data.response.success) throw new Error(data.response.message);

		return data.response.servers;
	}

	public static async getServersInAddress(address: string) {
		const url = new URL('https://api.steampowered.com/ISteamApps/GetServersAtAddress/v1/');
		url.searchParams.set('addr', address);

		const data = await get(url) as Response<{ servers: serverData[] }>;
		if(!data.response.success) throw new Error(data.response.message);

		return data.response.servers;
	}

	public static async getAppsList() {
		const url = new URL('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
		const data = await get(url) as {
			applist: {
				apps: Array<{
					appid: number;
					name: string;
				}>;
			};
		};
		return data.applist.apps;
	}
}

export default WebApi;