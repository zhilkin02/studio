import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';
import { Readable } from 'stream';

// Helper to convert Node.js stream to Web Stream
function toReadableStream(nodeStream: NodeJS.ReadableStream): ReadableStream {
    return new ReadableStream({
        start(controller) {
            nodeStream.on("data", (chunk) => controller.enqueue(chunk));
            nodeStream.on("end", () => controller.close());
            nodeStream.on("error", (err) => controller.error(err));
        },
    });
}


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

    // Prefer a format that has both video and audio. 720p is usually a good compromise.
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: (f) => f.container === 'mp4' && f.hasAudio && f.hasVideo,
    });
    
     if (!format) {
       // Fallback to highest quality if no combined format is found (might be audio only or video only)
       const fallbackFormat = ytdl.chooseFormat(info.formats, { quality: 'highest' });
        if (!fallbackFormat) {
          return new NextResponse('Could not find any suitable video format.', { status: 500 });
        }
         return new NextResponse('Could not find a format with both video and audio. High-quality streams might be separate.', { status: 500 });
    }

    const videoStream = ytdl(videoUrl, { format });
    const webStream = toReadableStream(videoStream);

    const safeTitle = (title).replace(/[^a-z0-9_ -]/gi, '_');
    const filename = `${safeTitle}.mp4`;

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Type', 'video/mp4');

    return new NextResponse(webStream, { headers });

  } catch (error: any) {
    console.error(`Error processing download for video ID ${videoId}:`, error);
    const errorMessage = error.message || 'An unknown error occurred';
    return new NextResponse(
        `Failed to download video. Reason: ${errorMessage}`, 
        { status: 500 }
    );
  }
}
