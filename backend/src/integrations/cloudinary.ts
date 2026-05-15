import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from 'cloudinary';
import { Readable } from 'stream';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

interface CloudinaryConfig {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

function configure(): CloudinaryConfig {
  const config: CloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
  };

  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new AppError(500, 'CLOUDINARY_CONFIG_ERROR', 'Cloudinary credentials not configured', 'Vitambulisho vya Cloudinary havijasanidiwa');
  }

  cloudinary.config(config);
  return config;
}

function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function uploadFromBuffer(
  buffer: Buffer,
  folder: string,
  options?: UploadApiOptions
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `menumoja/${folder}`,
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload failed', { error, folder });
          reject(new AppError(502, 'CLOUDINARY_UPLOAD_FAILED', 'Failed to upload image to Cloudinary', 'Imeshindwa kupakia picha kwa Cloudinary'));
        } else if (result) {
          resolve(result);
        } else {
          reject(new AppError(502, 'CLOUDINARY_UPLOAD_FAILED', 'Cloudinary upload returned no result', 'Cloudinary haukurudisha matokeo'));
        }
      }
    );

    if (Buffer.isBuffer(buffer)) {
      bufferToStream(buffer).pipe(uploadStream);
    }
  });
}

async function uploadFromUrl(
  url: string,
  folder: string,
  options?: UploadApiOptions
): Promise<UploadApiResponse> {
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder: `menumoja/${folder}`,
      resource_type: 'image',
      ...options,
    });
    return result;
  } catch (error) {
    logger.error('Cloudinary URL upload failed', { error, url: url.substring(0, 100) });
    throw new AppError(502, 'CLOUDINARY_UPLOAD_FAILED', 'Failed to upload image from URL', 'Imeshindwa kupakia picha kutoka URL');
  }
}

export async function uploadImage(
  file: Buffer | string,
  folder: string,
  options?: UploadApiOptions
): Promise<{ url: string; thumbnailUrl: string; publicId: string }> {
  configure();

  let result: UploadApiResponse;

  if (Buffer.isBuffer(file)) {
    result = await uploadFromBuffer(file, folder, options);
  } else {
    result = await uploadFromUrl(file, folder, options);
  }

  const thumbnailUrl = cloudinary.url(result.public_id, {
    width: 400,
    height: 400,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto',
  });

  return {
    url: result.secure_url,
    thumbnailUrl,
    publicId: result.public_id,
  };
}

export async function uploadMultipleImages(
  files: Buffer[],
  folder: string
): Promise<Array<{ url: string; thumbnailUrl: string; publicId: string }>> {
  configure();

  if (!files.length) return [];

  const uploads = files.map((file) => uploadImage(file, folder));
  const results = await Promise.allSettled(uploads);

  const successful: Array<{ url: string; thumbnailUrl: string; publicId: string }> = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      logger.error('Multiple image upload: one failed', { error: result.reason });
    }
  }

  if (!successful.length) {
    throw new AppError(502, 'CLOUDINARY_UPLOAD_FAILED', 'All image uploads failed', 'Upakiaji wote wa picha umeshindwa');
  }

  return successful;
}

export async function deleteImage(publicId: string): Promise<void> {
  configure();

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok') {
      logger.warn('Cloudinary delete returned non-ok', { publicId, result: result.result });
    }
  } catch (error) {
    logger.error('Cloudinary delete failed', { error, publicId });
    throw new AppError(502, 'CLOUDINARY_DELETE_FAILED', 'Failed to delete image from Cloudinary', 'Imeshindwa kufuta picha kutoka Cloudinary');
  }
}

export function generateSignedUrl(folder: string, options?: Record<string, unknown>): string {
  configure();

  const timestamp = Math.round(Date.now() / 1000);
  const folderPath = `menumoja/${folder}`;

  const params: Record<string, any> = {
    timestamp,
    folder: folderPath,
    ...options,
  };

  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET || ''
  );

  params.api_key = process.env.CLOUDINARY_API_KEY;
  params.signature = signature;

  const queryString = Object.entries(params)
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
    .join('&');

  return `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload?${queryString}`;
}

export async function enhanceImage(
  imageUrl: string,
  restaurantId: string
): Promise<{ url: string; thumbnailUrl: string }> {
  configure();

  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: `menumoja/restaurants/${restaurantId}/enhanced`,
      resource_type: 'image',
      eager: [
        { width: 800, height: 800, crop: 'fill', quality: 'auto', fetch_format: 'auto', effect: 'auto_brightness' },
        { width: 400, height: 400, crop: 'fill', quality: 'auto', fetch_format: 'auto', effect: 'auto_brightness' },
      ],
      eager_async: true,
    });

    return {
      url: result.eager?.[0]?.secure_url || result.secure_url,
      thumbnailUrl: result.eager?.[1]?.secure_url || cloudinary.url(result.public_id, { width: 400, height: 400, crop: 'fill' }),
    };
  } catch (error) {
    logger.error('Image enhancement failed', { error, restaurantId });
    return { url: imageUrl, thumbnailUrl: imageUrl };
  }
}

export async function createMenuThumbnail(imageUrl: string): Promise<string> {
  configure();

  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'menumoja/thumbnails',
      resource_type: 'image',
      width: 400,
      height: 400,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
      gravity: 'auto',
    });

    return result.secure_url;
  } catch (error) {
    logger.error('Menu thumbnail creation failed', { error });
    return imageUrl;
  }
}

export function getOptimizedUrl(publicId: string, width?: number, height?: number): string {
  configure();

  const options: Record<string, any> = {
    quality: 'auto',
    fetch_format: 'auto',
  };

  if (width) options.width = width;
  if (height) options.height = height;
  if (width && height) options.crop = 'fill';

  return cloudinary.url(publicId, options);
}

export async function addWatermark(
  imagePublicId: string,
  logoPublicId: string,
  position: string = 'south_east',
  opacity: number = 60
): Promise<string> {
  configure();

  try {
    const result = await cloudinary.uploader.explicit(imagePublicId, {
      eager: [
        {
          transformation: [
            { width: 800, crop: 'scale' },
            {
              overlay: logoPublicId,
              width: 100,
              opacity,
              gravity: position,
              flags: 'relative',
            },
          ],
        },
      ],
      eager_async: true,
    });

    return result.eager?.[0]?.secure_url || cloudinary.url(imagePublicId);
  } catch (error) {
    logger.error('Watermark addition failed', { error, imagePublicId });
    return cloudinary.url(imagePublicId);
  }
}

export async function getImageInfo(publicId: string): Promise<{
  width: number;
  height: number;
  format: string;
  bytes: number;
}> {
  configure();

  try {
    const result = await cloudinary.api.resource(publicId);
    return {
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    logger.error('Failed to get image info', { error, publicId });
    throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image not found in Cloudinary', 'Picha haikupatikana kwenye Cloudinary');
  }
}

export default {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  generateSignedUrl,
  enhanceImage,
  createMenuThumbnail,
  getOptimizedUrl,
  addWatermark,
  getImageInfo,
};
