import { v2 as cloudinary } from 'cloudinary';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const { clips, referencePublicId, settings, prompt } = req.body;
    // clips: array of { publicId, duration }
    // referencePublicId: cloudinary public_id of reference video (optional)
    // settings: { speed, textOverlay, textPosition, audioPublicId }
    // prompt: user's edit description

    if (!clips || clips.length === 0) {
      return res.status(400).json({ error: 'No clips provided' });
    }

    const speed = parseFloat(settings?.speed || 1.0);
    const textOverlay = settings?.textOverlay || '';
    const textPosition = settings?.textPosition || 'bottom';
    const audioPublicId = settings?.audioPublicId || null;

    // Build Cloudinary transformation chain
    const transformations = [];

    // Speed transformation
    if (speed !== 1.0) {
      transformations.push({ effect: `accelerate:${Math.round((speed - 1) * 100)}` });
    }

    // Scale to 1080p
    transformations.push({ width: 1920, height: 1080, crop: 'pad', background: 'black' });

    // Apply reference video color style using Cloudinary's style transfer
    if (referencePublicId) {
      transformations.push({
        effect: `style_transfer`,
        overlay: referencePublicId,
        strength: 60
      });
    }

    // Text overlay
    if (textOverlay) {
      const yGravity = textPosition === 'top' ? 'north' : textPosition === 'center' ? 'center' : 'south';
      transformations.push({
        overlay: {
          font_family: 'Arial',
          font_size: 60,
          font_weight: 'bold',
          text: textOverlay
        },
        color: 'white',
        gravity: yGravity,
        y: textPosition === 'center' ? 0 : 40,
        effect: 'shadow:40'
      });
    }

    // Build output URL for first clip with transformations
    // For multiple clips, we use Cloudinary's splice feature
    let outputUrl = '';

    if (clips.length === 1) {
      // Single clip
      outputUrl = cloudinary.url(clips[0].publicId, {
        resource_type: 'video',
        transformation: transformations,
        format: 'mp4',
        quality: 'auto'
      });
    } else {
      // Multiple clips - concatenate using Cloudinary
      const spliceTransformations = [];

      // Add each additional clip as a splice
      for (let i = 1; i < clips.length; i++) {
        spliceTransformations.push({
          overlay: `video:${clips[i].publicId.replace(/\//g, ':')}`,
          flags: 'splice',
          effect: 'transition'
        });
        spliceTransformations.push({ flags: 'layer_apply' });
      }

      // Add main transformations after concat
      const allTransformations = [...spliceTransformations, ...transformations];

      outputUrl = cloudinary.url(clips[0].publicId, {
        resource_type: 'video',
        transformation: allTransformations,
        format: 'mp4',
        quality: 'auto'
      });
    }

    // Add audio replacement if provided
    if (audioPublicId) {
      const audioUrl = cloudinary.url(clips[0].publicId, {
        resource_type: 'video',
        transformation: [
          ...transformations,
          {
            overlay: `video:${audioPublicId.replace(/\//g, ':')}`,
            flags: 'layer_apply'
          }
        ],
        format: 'mp4',
        quality: 'auto'
      });
      outputUrl = audioUrl;
    }

    return res.status(200).json({
      success: true,
      outputUrl,
      message: 'Video processed successfully'
    });

  } catch (err) {
    console.error('Edit error:', err);
    return res.status(500).json({ error: err.message });
  }
}
