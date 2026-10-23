import QRCode from 'qrcode';

// Local QR generation only: encodes an existing invitation URL, no remote
// service and no credentials beyond what the viewer's own share link holds.
export async function qrSvg(text:string):Promise<string>{
 if(!text)throw new Error('QR payload is empty');
 const svg=await QRCode.toString(text,{type:'svg',width:220,errorCorrectionLevel:'M',margin:4,color:{dark:'#000000',light:'#ffffff'}});
 if(!svg.startsWith('<svg'))throw new Error('QR generation failed');
 return svg;
}
