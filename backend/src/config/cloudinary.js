const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a buffer to Cloudinary as a video resource.
 * Returns a promise that resolves with the Cloudinary upload result.
 *
 * @param {Buffer} buffer  - File buffer from multer memoryStorage
 * @param {string} filename - Original filename (used to build public_id)
 */
const uploadToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    // Strip extension — Cloudinary appends its own
    const publicId = `vibesync/${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        public_id: publicId,
        // Allow very large files (Cloudinary default cap is 100MB on free tier)
        chunk_size: 6_000_000,   // 6 MB chunks
        eager: [],               // no eager transforms — save quota
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

const isConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME &&
     process.env.CLOUDINARY_API_KEY &&
     process.env.CLOUDINARY_API_SECRET);

/**
 * Generates a signature for a direct authenticated upload from the client.
 */
const generateUploadSignature = (params) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { ...params, timestamp },
    process.env.CLOUDINARY_API_SECRET
  );
  return { timestamp, signature, apiKey: process.env.CLOUDINARY_API_KEY, cloudName: process.env.CLOUDINARY_CLOUD_NAME };
};

module.exports = { cloudinary, uploadToCloudinary, isConfigured, generateUploadSignature };
