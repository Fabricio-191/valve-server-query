import Server from './server';
import MasterServer from './masterserver';

/**
 * If the value is false, the socket will not keep the node.js process alive
 * @param value Whenether to ref or not the socket
 */
declare function setSocketRef(value: boolean): void;

export {
	Server,
	MasterServer,
	setSocketRef
};