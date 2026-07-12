export type CapturedImage = {
  imageBase64: string;
  imageMimeType: string;
  blob: Blob;
};

export const DEFAULT_CAPTURE_IMAGE_MIME_TYPE = 'image/png';

export async function imageFileToCapturedImage(file: File): Promise<CapturedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file before saving a target.');
  }

  return {
    imageBase64: await blobToBase64(file),
    imageMimeType: file.type || DEFAULT_CAPTURE_IMAGE_MIME_TYPE,
    blob: file,
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
