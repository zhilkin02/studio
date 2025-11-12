import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const title = searchParams.get('title') || 'video';

    if (!videoId || !ytdl.validateID(videoId)) {
      return new NextResponse('Invalid or missing YouTube Video ID', { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoInfo = await ytdl.getInfo(videoUrl);

    // Find the best format with video and audio
    const format = ytdl.chooseFormat(videoInfo.formats, { 
        quality: 'highest',
        filter: (format) => format.hasVideo && format.hasAudio 
    });

    if (!format) {
         return new NextResponse('Could not find a suitable video format to download.', { status: 500 });
    }

    const videoStream = ytdl(videoUrl, { format });
    
    // Sanitize title for file name
    const sanitizedTitle = title.replace(/[^a-z0-9а-яё\s]/gi, '_').replace(/ /g, '_');
    const fileExtension = format.container || 'mp4';


    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${sanitizedTitle}.${fileExtension}"`
    );

    // @ts-ignore - ReadableStream is compatible with NextResponse body
    return new NextResponse(videoStream, { headers });

  } catch (error: any) {
    console.error(`Error downloading video: ${error.message}`);
    return new NextResponse(`Error downloading video: ${error.message}`, { status: 500 });
  }
}
