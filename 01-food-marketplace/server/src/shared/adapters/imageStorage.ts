import { v2 as cloudinary } from "cloudinary";
import { config, features } from "../config.js";
import { ServiceUnavailableError } from "../errors.js";

export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface ImageStorage {
  upload(buffer: Buffer, filename: string): Promise<UploadedImage>;
  remove(publicId: string | null | undefined): Promise<void>;
}

class CloudinaryImageStorage implements ImageStorage {
  constructor() {
    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      throw new ServiceUnavailableError("Cloudinary is not configured");
    }
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true
    });
  }

  async upload(buffer: Buffer, filename: string): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "freshmarket/products",
          resource_type: "image",
          public_id: filename,
          overwrite: false
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Cloudinary upload failed"));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(buffer);
    });
  }

  async remove(publicId: string | null | undefined): Promise<void> {
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      // Orphaned assets are logged by the caller; replacing the image still succeeds.
    }
  }
}

let storage: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
  if (storage) return storage;
  if (!features.cloudinary) {
    throw new ServiceUnavailableError(
      "Cloudinary is not configured. Add CLOUDINARY_* variables to server/.env."
    );
  }
  storage = new CloudinaryImageStorage();
  return storage;
}

export function setImageStorageForTests(next: ImageStorage | null): void {
  if (config.env !== "test") {
    throw new Error("setImageStorageForTests is test-only");
  }
  storage = next;
}
