const MAX_LONG_EDGE = 1920;
const JPEG_QUALITY = 0.8;

function loadImageFromSource(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

async function decodeBlob(blob: Blob): Promise<HTMLImageElement> {
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    return await loadImageFromSource(canvas.toDataURL('image/png'));
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      return await loadImageFromSource(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function compressImage(blob: Blob): Promise<Blob> {
  const img = await decodeBlob(blob);

  let { width, height } = img;
  if (width > MAX_LONG_EDGE || height > MAX_LONG_EDGE) {
    if (width > height) {
      height = Math.round((height / width) * MAX_LONG_EDGE);
      width = MAX_LONG_EDGE;
    } else {
      width = Math.round((width / height) * MAX_LONG_EDGE);
      height = MAX_LONG_EDGE;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

export async function generateThumbnail(blob: Blob, maxSize = 150): Promise<Blob> {
  const img = await decodeBlob(blob);

  let { width, height } = img;
  if (width > height) {
    height = Math.round((height / width) * maxSize);
    width = maxSize;
  } else {
    width = Math.round((width / height) * maxSize);
    height = maxSize;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Thumbnail generation failed'));
      },
      'image/jpeg',
      0.6
    );
  });
}
