import { encode } from 'blurhash';
import sharp from 'sharp';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

const toArrayBuffer = async (res: Response): Promise<ArrayBuffer> => {
  const ab = await res.arrayBuffer();
  return ab;
};

export const blurHashFromImageUrl = async (imgUrl: string): Promise<string> => {
  let url: URL;
  try {
    url = new URL(imgUrl);
  } catch {
    throw new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid));
  }
  if (url.protocol !== 'https:') {
    throw new AppError(ErrorKey.RequestInvalid, 'imgUrl must be a valid HTTPS URL');
  }

  let res: Response;
  try {
    res = await fetch(imgUrl, { method: 'GET' });
  } catch {
    throw new AppError(ErrorKey.RequestInvalid, 'Failed to fetch image from imgUrl');
  }

  if (!res.ok) {
    throw new AppError(ErrorKey.RequestInvalid, `Failed to fetch image from imgUrl (status ${res.status})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new AppError(ErrorKey.RequestInvalid, `imgUrl does not point to an image (content-type: ${contentType})`);
  }

  const buf = Buffer.from(await toArrayBuffer(res));

  try {
    // BlurHash spec commonly uses small components; resize to keep it fast.
    const width = 32;
    const height = 32;
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const actualWidth = info.width || width;
    const actualHeight = info.height || height;
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

    // component selection: balance quality vs size
    return encode(pixels, actualWidth, actualHeight, 4, 3);
  } catch {
    throw new AppError(ErrorKey.RequestInvalid, 'Failed to decode image for blurhash');
  }
};

export const ensureThemeBlurHashes = async (theme: any): Promise<void> => {
  if (!theme?.imgUrl) {
    throw new AppError(ErrorKey.RequestInvalid, 'imgUrl is required');
  }

  if (!theme.blurHash) {
    theme.blurHash = await blurHashFromImageUrl(String(theme.imgUrl));
  }

  // Backward compatibility: if client still expects per-view fields, propagate.
  const views = [theme?.calendarMonthlyView, theme?.calendarWeeklyView, theme?.homeView].filter(Boolean);
  for (const view of views) {
    if (!view.imgUrl) view.imgUrl = theme.imgUrl;
    if (!view.blurHash) view.blurHash = theme.blurHash;
  }
};

