const cloudinary = require('cloudinary').v2;

// 1. Configure Cloudinary inline
cloudinary.config({
  cloud_name: 'dqevrzhxe',
  api_key: '613463546287651',
  api_secret: 'Fpe9fE6Hk4UgjJul6g0S2K-X6sw'
});

async function runOnboarding() {
  try {
    const sampleImageUrl = 'https://res.cloudinary.com/demo/image/upload/dog.jpg';
    console.log('Uploading sample image from:', sampleImageUrl);
    
    // 2. Upload the image
    const uploadResult = await cloudinary.uploader.upload(sampleImageUrl, {
      folder: 'onboarding_demo'
    });
    
    console.log('Upload Secure URL:', uploadResult.secure_url);
    console.log('Upload Public ID:', uploadResult.public_id);
    
    // 3. Get image details (fetch metadata)
    console.log('\nFetching image details from API...');
    const details = await cloudinary.api.resource(uploadResult.public_id);
    
    console.log(`Image Details:`);
    console.log(`- Width: ${details.width}px`);
    console.log(`- Height: ${details.height}px`);
    console.log(`- Format: ${details.format}`);
    console.log(`- File Size: ${details.bytes} bytes`);
    
    // 4. Transform the image
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      // f_auto: Automatically selects the best image format based on browser support (WebP, AVIF, etc.)
      fetch_format: 'auto',
      // q_auto: Optimizes the image quality levels dynamically to balance visual quality with file size reduction
      quality: 'auto',
      secure: true
    });
    
    console.log('\nDone! Click link below to see optimized version of the image. Check the size and the format.');
    console.log(transformedUrl);
    
  } catch (error) {
    console.error('Error during Cloudinary onboarding:', error);
  }
}

runOnboarding();
