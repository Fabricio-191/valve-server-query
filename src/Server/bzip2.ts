/*
bzip2.js - a small bzip2 decompression implementation
Copyright 2011 by antimatter15 (antimatter15@gmail.com)
Based on micro-bunzip by Rob Landley (rob@landley.net).
Based on bzip2 decompression code by Julian R Seward (jseward@acm.org),
which also acknowledges contributions by Mike Burrows, David Wheeler,
Peter Fenwick, Alistair Moffat, Radford Neal, Ian H. Witten,
Robert Sedgewick, and Jon L. Bentley.
I hereby release this code under the GNU Library General Public License
(LGPL) version 2, available at http://www.gnu.org/copyleft/lgpl.html
*/

type Bits = (n: number) => number;
function getBits(bytes: Buffer): Bits {
	let bit = 0, byte = 0;
	const BITMASK = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF];
	return function(n: number) {
		let result = 0;
		while(n > 0) {
			const left = 8 - bit;
			if(n >= left) {
				result <<= left;
				result |= BITMASK[left]! & bytes[byte++]!;
				bit = 0;
				n -= left;
			}else{
				result <<= n;
				result |= (bytes[byte]! & BITMASK[n]! << 8 - n - bit) >> 8 - n - bit;
				bit += n;
				n = 0;
			}
		}
		return result;
	};
}

function decompressBlock(bits: Bits): Uint8Array | -1 {
	const MAX_HUFCODE_BITS = 20;
	const MAX_SYMBOLS = 258;
	const SYMBOL_RUNA = 0;
	const SYMBOL_RUNB = 1;
	const GROUP_SIZE = 50;

	const bufsize = 100000 * 9;
	let h = '', i = 0, j = 0;
	for(; i < 6; i++) h += bits(8).toString(16);

	if(h === '177245385090') return -1; // last block
	if(h !== '314159265359') throw'eek not valid bzip data';

	bits(32); // ignore CRC codes
	if(bits(1)) throw'unsupported obsolete version';
	const origPtr = bits(24);
	if(origPtr > bufsize) throw'Initial position larger than buffer size';
	var t = bits(16);
	let symToByte = new Uint8Array(256),
		symTotal = 0;
	for(i = 0; i < 16; i++) {
		if(t & 1 << 15 - i) {
			var k = bits(16);
			for(j = 0; j < 16; j++) {
				if(k & 1 << 15 - j) {
					symToByte[symTotal++] = 16 * i + j;
				}
			}
		}
	}

	const groupCount = bits(3);
	if(groupCount < 2 || groupCount > 6) throw'another error';
	const nSelectors = bits(15);
	if(nSelectors == 0) throw'meh';
	const mtfSymbol: number[] = []; // TODO: possibly replace JS array with typed arrays
	for(i = 0; i < groupCount; i++) mtfSymbol[i] = i;
	const selectors = new Uint8Array(32768);

	for(i = 0; i < nSelectors; i++) {
		for(j = 0; bits(1); j++)if(j >= groupCount) throw'whoops another error';
		var uc = mtfSymbol[j];
		mtfSymbol.splice(j, 1); // this is a probably inefficient MTF transform
		mtfSymbol.splice(0, 0, uc);
		selectors[i] = uc;
	}

	let symCount = symTotal + 2;
	const groups: object[] = [];
	for(j = 0; j < groupCount; j++) {
		const length = new Uint8Array(MAX_SYMBOLS),
			temp = new Uint8Array(MAX_HUFCODE_BITS + 1);
		t = bits(5); // lengths
		for(i = 0; i < symCount; i++) {
			while(true) {
				if(t < 1 || t > MAX_HUFCODE_BITS) throw'I gave up a while ago on writing error messages';
				if(!bits(1)) break;
				if(!bits(1)) t++;
				else t--;
			}
			length[i] = t;
		}
		var minLen, maxLen = minLen = length[0];
		for(i = 1; i < symCount; i++) {
			if(length[i] > maxLen) maxLen = length[i];
			else if(length[i] < minLen) minLen = length[i];
		}
		var hufGroup;
		hufGroup = groups[j] = {};
		hufGroup.permute = new Uint32Array(MAX_SYMBOLS);
		hufGroup.limit = new Uint32Array(MAX_HUFCODE_BITS + 1);
		hufGroup.base = new Uint32Array(MAX_HUFCODE_BITS + 1);
		hufGroup.minLen = minLen;
		hufGroup.maxLen = maxLen;
		var base = hufGroup.base.subarray(1);
		var limit = hufGroup.limit.subarray(1);
		let pp = 0;
		for(i = minLen; i <= maxLen; i++)for(var t = 0; t < symCount; t++)if(length[t] == i) hufGroup.permute[pp++] = t;
		for(i = minLen; i <= maxLen; i++) temp[i] = limit[i] = 0;
		for(i = 0; i < symCount; i++) temp[length[i]]++;
		pp = t = 0;
		for(i = minLen; i < maxLen; i++) {
			pp += temp[i];
			limit[i] = pp - 1;
			pp <<= 1;
			base[i + 1] = pp - (t += temp[i]);
		}
		limit[maxLen] = pp + temp[maxLen] - 1;
		base[minLen] = 0;
	}
	const byteCount = new Uint32Array(256);
	for(i = 0; i < 256; i++) mtfSymbol[i] = i;
	let runPos = 0, count = 0, selector = 0; 
	symCount = 0;

	const buf = new Uint32Array(bufsize);
	while(true) {
		if(!symCount--) {
			symCount = GROUP_SIZE - 1;
			if(selector >= nSelectors) throw"meow i'm a kitty, that's an error";
			hufGroup = groups[selectors[selector++]];
			base = hufGroup.base.subarray(1);
			limit = hufGroup.limit.subarray(1);
		}
		i = hufGroup.minLen;
		j = bits(i);
		while(true) {
			if(i > hufGroup.maxLen) throw"rawr i'm a dinosaur";
			if(j <= limit[i]) break;
			i++;
			j = j << 1 | bits(1);
		}
		j -= base[i];
		if(j < 0 || j >= MAX_SYMBOLS) throw"moo i'm a cow";
		const nextSym = hufGroup.permute[j];
		if(nextSym == SYMBOL_RUNA || nextSym == SYMBOL_RUNB) {
			if(!runPos) {
				runPos = 1;
				t = 0;
			}
			if(nextSym == SYMBOL_RUNA) t += runPos;
			else t += 2 * runPos;
			runPos <<= 1;
			continue;
		}
		if(runPos) {
			runPos = 0;
			if(count + t >= bufsize) throw'Boom.';
			uc = symToByte[mtfSymbol[0]];
			byteCount[uc] += t;
			while(t--) buf[count++] = uc;
		}
		if(nextSym > symTotal) break;
		if(count >= bufsize) throw"I can't think of anything. Error";
		i = nextSym - 1;
		uc = mtfSymbol[i];
		mtfSymbol.splice(i, 1);
		mtfSymbol.splice(0, 0, uc);
		uc = symToByte[uc];
		byteCount[uc]++;
		buf[count++] = uc;
	}
	if(origPtr < 0 || origPtr >= count) throw"I'm a monkey and I'm throwing something at someone, namely you";
	j = 0;
	for(i = 0; i < 256; i++) {
		k = j + byteCount[i];
		byteCount[i] = j;
		j = k;
	}
	for(i = 0; i < count; i++) {
		uc = buf[i] & 0xff;
		buf[byteCount[uc]] |= i << 8;
		byteCount[uc]++;
	}
	let pos = 0,
		current = 0,
		run = 0;
	if(count) {
		pos = buf[origPtr];
		current = pos & 0xff;
		pos >>= 8;
		run = -1;
	}
	count = count;
	const output = new Uint8Array(bufsize);
	let copies, previous, outbyte;
	let index = 0;
	while(count) {
		count--;
		previous = current;
		pos = buf[pos];
		current = pos & 0xff;
		pos >>= 8;
		if(run++ == 3) {
			copies = current;
			outbyte = previous;
			current = -1;
		}else{
			copies = 1;
			outbyte = current;
		}
		while(copies--) {
			// output += (String.fromCharCode(outbyte));
			output[index++] = outbyte;
			// index++;
		}
		if(current !== previous) run = 0;
	}
	// return output;
	// return output.subarray(0,index-1);
	return output.subarray(0, index);
}

export default function decompress(buffer: Buffer): Buffer {
	const bits = getBits(buffer);

	if(bits(8 * 3) !== 4348520) throw new Error('No magic number found');

	const size = bits(8) - 48;
	if(size < 1 || size > 9) throw new Error('Not a BZIP archive');
	const chunks: Uint8Array[] = [];
	let index = 0;

	let chunk = decompressBlock(bits);
	while(chunk !== -1){
		chunks.push(chunk);
		index += chunk.byteLength;
		chunk = decompressBlock(bits);
	}

	const all = new Uint8Array(index);
	index = 0;
	for(const chunk of chunks){
		all.set(chunk, index);
		index += chunk.byteLength;
	}

	return Buffer.from(all);
}