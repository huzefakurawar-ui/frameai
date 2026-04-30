import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '150mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const tmpDir = path.join(os.tmpdir(), `frameai_${Date.now()}`);
  const filesToClean = [];

  try {
    await mkdir(tmpDir, { recursive: true });

    const { videos, audio, settings } = req.body;

    if (!videos || videos.length === 0) {
      return res.status(400).json({ error: 'No video files provided' });
    }

    const videoPaths = [];
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const ext = v.name.split('.').pop() || 'mp4';
      const filePath = path.join(tmpDir, `clip_${i}.${ext}`);
      const buffer = Buffer.from(v.data, 'base64');
      await writeFile(filePath, buffer);
      videoPaths.push(filePath);
      filesToClean.push(filePath);
    }

    let audioPath = null;
    if (audio && audio.data) {
      const audioExt = audio.name.split('.').pop() || 'mp3';
      audioPath = path.join(tmpDir, `audio.${audioExt}`);
      const audioBuffer = Buffer.from(audio.data, 'base64');
      await writeFile(audioPath, audioBuffer);
      filesToClean.push(audioPath);
    }

    const outputPath = path.join(tmpDir, 'output.mp4');
    filesToClean.push(outputPath);

    let ffmpegPath = 'ffmpeg';
    try {
      const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
      ffmpegPath = ffmpegInstaller.path;
    } catch (e) {}

    const speed = settings?.speed || 1.0;
    const textOverlay = settings?.textOverlay || '';

    let ffmpegCmd = '';

    if (videoPaths.length === 1) {
      const inputPath = videoPaths[0];
      const filters = [];

      if (speed !== 1.0) {
        filters.push(`setpts=${(1/speed).toFixed(2)}*PTS`);
      }

      filters.push('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2');

      if (textOverlay) {
        const safeText = textOverlay.replace(/'/g, "\\'").replace(/:/g, "\\:");
        const position = settings?.textPosition || 'bottom';
        const yPos = position === 'top' ? '50' : position === 'center' ? '(h-text_h)/2' : 'h-th-50';
        filters.push(`drawtext=text='${safeText}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=${yPos}:shadowcolor=black:shadowx=2:shadowy=2`);
      }

      const filterComplex = filters.join(',');

      if (audioPath) {
        ffmpegCmd = `"${ffmpegPath}" -i "${inputPath}" -i "${audioPath}" -vf "${filterComplex}" -c:v libx264 -preset fast -crf 23 -map 0:v:0 -map 1:a:0 -shortest -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`;
      } else {
        ffmpegCmd = `"${ffmpegPath}" -i "${inputPath}" -vf "${filterComplex}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`;
      }

    } else {
      const reEncodedPaths = [];
      for (let i = 0; i < videoPaths.length; i++) {
        const reencPath = path.join(tmpDir, `reenc_${i}.mp4`);
        filesToClean.push(reencPath);

        let vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2';
        if (speed !== 1.0) {
          vf = `setpts=${(1/speed).toFixed(2)}*PTS,` + vf;
        }

        const reencCmd = `"${ffmpegPath}" -i "${videoPaths[i]}" -vf "${vf}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -r 30 -y "${reencPath}"`;
        await execAsync(reencCmd, { timeout: 50000 });
        reEncodedPaths.push(reencPath);
      }

      const concatListPath = path.join(tmpDir, 'concat.txt');
      filesToClean.push(concatListPath);
      const concatContent = reEncodedPaths.map(p => `file '${p}'`).join('\n');
      await writeFile(concatListPath, concatContent);

      let postFilter = '';
      if (textOverlay) {
        const safeText = textOverlay.replace(/'/g, "\\'").replace(/:/g, "\\:");
        const position = settings?.textPosition || 'bottom';
        const yPos = position === 'top' ? '50' : position === 'center' ? '(h-text_h)/2' : 'h-th-50';
        postFilter = `-vf "drawtext=text='${safeText}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=${yPos}:shadowcolor=black:shadowx=2:shadowy=2"`;
      }

      if (audioPath) {
        const concatNoAudioPath = path.join(tmpDir, 'concat_noaudio.mp4');
        filesToClean.push(concatNoAudioPath);
        await execAsync(`"${ffmpegPath}" -f concat -safe 0 -i "${concatListPath}" -c copy -y "${concatNoAudioPath}"`, { timeout: 50000 });
        ffmpegCmd = `"${ffmpegPath}" -i "${concatNoAudioPath}" -i "${audioPath}" ${postFilter} -c:v libx264 -preset fast -crf 23 -map 0:v:0 -map 1:a:0 -shortest -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`;
      } else {
        ffmpegCmd = `"${ffmpegPath}" -f concat -safe 0 -i "${concatListPath}" ${postFilter} -c copy -movflags +faststart -y "${outputPath}"`;
      }
    }

    await execAsync(ffmpegCmd, { timeout: 55000 });

    const outputBuffer = await readFile(outputPath);
    const base64Output = outputBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      video: base64Output,
      filename: 'frameai_output.mp4'
    });

  } catch (err) {
    console.error('FFmpeg error:', err);
    return res.status(500).json({ error: 'Video processing failed: ' + err.message });
  } finally {
    for (const f of filesToClean) {
      try { await unlink(f); } catch (e) {}
    }
    try {
      const { rmdir } = await import('fs/promises');
      await rmdir(tmpDir);
    } catch (e) {}
  }
}
