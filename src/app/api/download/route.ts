import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

export const config = {
  runtime: 'edge', // Using edge runtime for better performance with streaming
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('v');
  const title = searchParams.get('title') || 'video';

  if (!videoId || !ytdl.validateID(videoId)) {
    return new NextResponse('Invalid or missing YouTube Video ID', { status: 400 });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await ytdl.getInfo(videoUrl);

    // Find a format that has both video and audio, prioritizing quality up to 720p
    // 1080p and higher often come as separate streams, which is more complex.
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highest',
      filter: (f) => f.hasVideo && f.hasAudio,
    });
    
    if (!format) {
       return new NextResponse('Could not find a suitable video format with audio.', { status: 500 });
    }

    const videoStream = ytdl(videoUrl, { format });

    // Sanitize the filename to prevent security issues
    const safeTitle = title.replace(/[^a-z0-9_ -]/gi, '_');
    const filename = `${safeTitle}.mp4`;

    // Set headers to prompt a download
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Type', 'video/mp4');

    // Create a new ReadableStream from the ytdl stream
    const readableStream = new ReadableStream({
      start(controller) {
        videoStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        videoStream.on('end', () => {
          controller.close();
        });
        videoStream.on('error', (err) => {
          console.error("ytdl stream error:", err);
          controller.error(err);
        });
      },
      cancel() {
        videoStream.destroy();
      }
    });

    return new NextResponse(readableStream, { headers });

  } catch (error: any) {
    console.error(`Error fetching video info for ID ${videoId}:`, error);
    return new NextResponse(error.message || 'Failed to download video', { status: 500 });
  }
}
