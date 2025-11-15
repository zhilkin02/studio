import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';
import { PassThrough } from 'stream';

// Do not use edge runtime, ytdl-core is not compatible with it.

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

    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highest',
      filter: (f) => f.hasVideo && f.hasAudio,
    });
    
    if (!format) {
       return new NextResponse('Could not find a suitable video format with audio.', { status: 500 });
    }

    const videoStream = ytdl(videoUrl, { format });
    const passThrough = new PassThrough();
    videoStream.pipe(passThrough);

    const safeTitle = title.replace(/[^a-z0-9_ -]/gi, '_');
    const filename = `${safeTitle}.mp4`;

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Type', 'video/mp4');

    // @ts-ignore - ReadableStream is compatible with PassThrough
    return new NextResponse(passThrough, { headers });

  } catch (error: any) {
    console.error(`Error processing download for video ID ${videoId}:`, error);
    // Provide a more informative error response to the client
    const errorMessage = error.message || 'An unknown error occurred';
    return new NextResponse(
        `Failed to download video. Reason: ${errorMessage}`, 
        { status: 500 }
    );
  }
}
