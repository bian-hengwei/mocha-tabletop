// createImageBitmap decodes an animation's default/first frame, independently
// of playback timing (HTML Standard, ImageBitmap). Keep original animation bytes.
export async function reactionStill(file:File):Promise<Blob>{
 const invalid='仅支持 2 MB 内、1024 × 1024 内的 GIF 或 PNG';
 if(file.size>2*1024*1024)throw new Error(invalid);
 const bytes=new Uint8Array(await file.slice(0,24).arrayBuffer());
 const png=bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const gif=bytes.length>=10&&['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.slice(0,6)));
 if(!png&&!gif)throw new Error(invalid);
 const view=new DataView(bytes.buffer),width=png?view.getUint32(16):view.getUint16(6,true),height=png?view.getUint32(20):view.getUint16(8,true);
 if(!width||!height||width>1024||height>1024)throw new Error(invalid);
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw new Error('图片无效');}
 try{
  const canvas=document.createElement('canvas'),scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('静态预览生成失败');
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob||blob.size>2*1024*1024)throw new Error('静态预览生成失败');
  return blob;
 }finally{bitmap.close();}
}
