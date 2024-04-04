import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import * as dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function compressAndUploadImages() {
  let totalSize = 0;
  let totalCompressedSize = 0;
  let nextCursor = null;
  let requestCount = 0;

  const max_results = 100;
  const rateLimit = 900; // adjust as per your cloudinary plan anon
  const resizeSize = 200;
  const quality = 80;

  try {
    do {
      const { resources, next_cursor } = await cloudinary.api.resources({
        max_results,
        next_cursor: nextCursor,
        resource_type: 'image',
      });
      nextCursor = next_cursor;
      requestCount += max_results;

      for (const image of resources) {
        const imageUrl = image.url;
        const imageName = image.public_id;
        const originalSize = image.bytes;
        totalSize += originalSize;

        try {
          const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
          });

          const buffer = Buffer.from(response.data);
          const compressed = await sharp(buffer)
            .resize(resizeSize)
            .jpeg({ quality })
            .toBuffer();

          totalCompressedSize += compressed.byteLength;
          await cloudinary.uploader
            .upload_stream(
              { public_id: imageName, resource_type: 'image' },
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              (error, _result) => {
                if (error) throw error;
              },
            )
            .end(compressed);
        } catch (error) {
          console.error(`Error processing image ${imageName}:`, error);
        }
      }

      console.log(
        `Processed ${resources.length} images in batch ${requestCount}.`,
      );

      const totalSpaceSaved = totalSize - totalCompressedSize;
      const totalSpaceSavedMB = totalSpaceSaved / (1024 * 1024);
      console.log(
        `Total space saved after processing this batch: ${totalSpaceSavedMB.toFixed(
          2,
        )} MB`,
      );

      if (requestCount >= rateLimit) {
        console.log('Approaching rate limit, pausing for an hour...');
        await new Promise((resolve) => setTimeout(resolve, 3600000));
        requestCount = 0;
      }
    } while (nextCursor);

    const totalSpaceSaved = totalSize - totalCompressedSize;
    const totalSpaceSavedMB = totalSpaceSaved / (1024 * 1024);
    const totalSizeMB = totalSize / (1024 * 1024);
    const totalCompressedSizeMB = totalCompressedSize / (1024 * 1024);

    console.log(`All images processed`);
    console.log(`Space Saved: ${totalSpaceSavedMB.toFixed(2)} MB`);
    console.log(`Original Size of images: ${totalSizeMB.toFixed(2)} MB`);
    console.log(`Size of images now: ${totalCompressedSizeMB.toFixed(2)} MB`);
  } catch (error) {
    console.error('Error fetching images from Cloudinary:', error);
  }
}

compressAndUploadImages().then(() => {
  console.log('Image compression and upload task completed.');
});
