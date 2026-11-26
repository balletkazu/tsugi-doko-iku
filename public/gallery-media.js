export const maxPhotos = 10;
export const inputFormats = 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.heic,.heif';
const maxInput = 20 * 1024 * 1024;
const types = new Set(['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']);

// Read only selected technical tags from JPEG/TIFF. In particular, do not traverse the GPS IFD.
export function jpegTechnicalExif(bytes) {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return {};
  for (let offset = 2; offset + 4 < bytes.length;) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda || marker === 0xffd9) return {};
    const length = view.getUint16(offset + 2);
    const payload = offset + 4;
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return {};
    if (marker === 0xffe1 && end - payload > 14 && view.getUint32(payload) === 0x45786966 && view.getUint16(payload+4) === 0) {
      return parseTiff(view,payload+6,end);
    }
    offset = end;
  }
  return {};
}

function parseTiff(view, base, end) {
  const order = view.getUint16(base);
  if (order !== 0x4949 && order !== 0x4d4d) return {};
  const little = order === 0x4949;
  const u16 = pos => view.getUint16(pos,little);
  const u32 = pos => view.getUint32(pos,little);
  if (u16(base+2) !== 42) return {};
  const read = (offset, targets) => {
    const start = base+offset;
    if (start < base+8 || start+2 > end) return {};
    const count = Math.min(u16(start),128);
    const values = {};
    for (let i = 0, pos = start+2; i < count && pos+12 <= end; i++, pos+=12) {
      const key = targets[u16(pos)];
      if (!key) continue;
      const type = u16(pos+2), n = u32(pos+4);
      const textTag = ['make','model','lens'].includes(key);
      if (key === 'sub' && type === 4 && n === 1) values.sub = u32(pos+8);
      else if (textTag && type === 2 && n > 0 && n <= 180) {
        const value = n <= 4 ? pos+8 : base+u32(pos+8);
        if (value >= base && value+n <= end) {
          const span = new Uint8Array(view.buffer,view.byteOffset+value,n);
          values[key] = new TextDecoder().decode(span).replace(/[\u0000-\u001f\u007f]/g,' ').trim();
        }
      } else if (!textTag && key !== 'sub' && type === 3 && n === 1) values[key] = u16(pos+8);
      else if (!textTag && key !== 'sub' && type === 5 && n === 1) {
        const value = base+u32(pos+8);
        if (value >= base && value+8 <= end && u32(value+4)) values[key] = u32(value)/u32(value+4);
      }
    }
    return values;
  };
  const { make, model, sub } = read(u32(base+4),{0x010f:'make',0x0110:'model',0x8769:'sub'});
  const { lens, exposure, aperture, iso, focal } = sub ? read(sub,{0xa434:'lens',0x829a:'exposure',0x829d:'aperture',0x8827:'iso',0x920a:'focal'}) : {};
  return Object.fromEntries(Object.entries({make,model,lens,exposure,aperture,iso,focal}).filter(([,value])=>value));
}

async function encode(bitmap, edge, quality) {
  const scale = Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1,Math.round(bitmap.width*scale));
  canvas.height = Math.max(1,Math.round(bitmap.height*scale));
  const context = canvas.getContext('2d',{alpha:false});
  context.fillStyle = '#fff';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
  if (!blob) throw new Error('写真の変換ができませんでした。');
  return {blob,width:canvas.width,height:canvas.height};
}

export async function importGalleryPhoto(file) {
  const jpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
  if (!types.has(file.type) && !/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name)) throw new Error('JPEGなどの画像ファイルを選んでください。');
  if (file.size > maxInput) throw new Error('写真は1枚20MB以下にしてください。');
  const technical = jpeg ? jpegTechnicalExif(new Uint8Array(await file.slice(0,262144).arrayBuffer())) : {};
  let bitmap;
  try {
    bitmap = await createImageBitmap(file,{imageOrientation:'from-image'});
  } catch {
    throw new Error('この端末で開けない画像です。JPEGまたはPNGに書き出してお試しください。');
  }
  try {
    let large = await encode(bitmap,2400,0.87);
    if (large.blob.size > 2 * 1024 * 1024) large = await encode(bitmap,2048,0.8);
    const thumbnail = await encode(bitmap,480,0.72);
    return {id:crypto.randomUUID(),large:large.blob,thumbnail:thumbnail.blob,width:large.width,height:large.height,
      technical, showTechnical:false, description:'', location:''};
  } finally {
    bitmap.close();
  }
}

export function technicalLabel(technical = {}) {
  const {make,model,lens,exposure,aperture,iso,focal} = technical;
  const camera = model?.toLocaleLowerCase().includes(make?.toLocaleLowerCase() ?? '') ? model : [make,model].filter(Boolean).join(' ');
  const format = value => Number(value.toFixed(1));
  return [camera,lens,exposure && (exposure<1 ? `1/${Math.round(1/exposure)}秒` : `${format(exposure)}秒`),
    aperture && `F${format(aperture)}`,iso && `ISO ${iso}`,focal && `${format(focal)} mm`].filter(Boolean).join(' · ');
}
