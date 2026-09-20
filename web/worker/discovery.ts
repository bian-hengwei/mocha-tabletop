/**
 * Canonical server-only discovery bucket. IPv4 uses the entire public egress
 * address; IPv6 uses its /64 so temporary per-device interface IDs can differ.
 * A bucket is only a candidate network, never proof of a common Wi-Fi/SSID.
 */
export function discoveryNetwork(address:string|null):string {
 if(typeof address!=='string'||address.length===0||address.length>45||address!==address.trim())throw new Error('网络地址无效');
 const ipv4=(text:string):number[]|null=>{
  const parts=text.split('.');
  if(parts.length!==4||parts.some(part=>!/^(0|[1-9]\d{0,2})$/.test(part)||Number(part)>255))return null;
  return parts.map(Number);
 };
 if(!address.includes(':')){const bytes=ipv4(address);if(!bytes)throw new Error('网络地址无效');return bytes.join('.');}
 // Headers contain bare IP literals, not URLs, lists, zone IDs, prefixes or ports.
 if(!/^[0-9a-fA-F:.]+$/.test(address))throw new Error('网络地址无效');
 let text=address.toLowerCase();
 if(text.includes('.')){
  const boundary=text.lastIndexOf(':');const bytes=ipv4(text.slice(boundary+1));
  if(!bytes)throw new Error('网络地址无效');
  text=text.slice(0,boundary+1)+((bytes[0]<<8)|bytes[1]).toString(16)+':'+((bytes[2]<<8)|bytes[3]).toString(16);
 }
 const halves=text.split('::');if(halves.length>2)throw new Error('网络地址无效');
 const parse=(part:string):number[]=>{
  if(!part)return [];
  const groups=part.split(':');if(groups.some(group=>!/^[0-9a-f]{1,4}$/.test(group)))throw new Error('网络地址无效');
  return groups.map(group=>parseInt(group,16));
 };
 const left=parse(halves[0]),right=halves.length===2?parse(halves[1]):[];
 let words:number[];
 if(halves.length===2){const zeros=8-left.length-right.length;if(zeros<1)throw new Error('网络地址无效');words=[...left,...Array<number>(zeros).fill(0),...right];}
 else {if(left.length!==8)throw new Error('网络地址无效');words=left;}
 // Do not group every IPv4-mapped address into the same all-zero IPv6 /64.
 if(words.slice(0,5).every(n=>n===0)&&words[5]===0xffff)return [words[6]>>>8,words[6]&255,words[7]>>>8,words[7]&255].join('.');
 return words.slice(0,4).map(word=>word.toString(16).padStart(4,'0')).join(':')+'::/64';
}
