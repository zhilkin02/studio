import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';
import { PassThrough } from 'stream';

// This function converts the ytdl stream into a ReadableStream that NextResponse can handle.
function streamToReadableStream(stream: PassThrough): ReadableStream {
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const videoId = searchParams.get('videoId');

        if (!videoId || !ytdl.validateID(videoId)) {
            return new NextResponse('Invalid or missing YouTube Video ID', { status: 400 });
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(videoUrl);

        // Sanitize the title to create a valid filename
        const title = info.videoDetails.title.replace(/[<>:"/\\|?*]+/g, '_');
        
        // Try to get a common 720p format first for stability. '136' is often 720p mp4.
        let format = ytdl.chooseFormat(info.formats, { quality: '136', filter: 'videoandaudio' });

        // If the preferred format is not found, try to find the highest quality with video and audio
        if (!format) {
             format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' });
        }
        
        // If still no combined format is found, fallback to highest quality video-only
        if (!format) {
             format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
             if(!format) {
                return new NextResponse('Could not find a suitable video format to download.', { status: 500 });
             }
        }

        // Get the readable stream from ytdl
        const videoStream = ytdl(videoUrl, { format });
        
        // Convert it to a format compatible with NextResponse
        const readableStream = streamToReadableStream(videoStream);

        const headers = new Headers();
        headers.set('Content-Type', format.mimeType || 'video/mp4');
        headers.set('Content-Disposition', `attachment; filename="${title}.mp4"`);

        // Use NextResponse to stream the response
        return new NextResponse(readableStream, { headers });

    } catch (error: any) {
        console.error('Failed to download video:', error);
        return new NextResponse(error.message || 'Failed to download video', { status: 500 });
    }
}
