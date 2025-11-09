import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

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
        
        // Find a format that has both video and audio
        let format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' });

        // If no combined format is found, this is a fallback (though less likely for modern videos)
        if (!format) {
             format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
             if(!format) {
                return new NextResponse('Could not find a suitable video format to download.', { status: 500 });
             }
        }

        // Get the readable stream
        const videoStream = ytdl(videoUrl, { format });
        
        const headers = new Headers();
        headers.set('Content-Type', 'video/mp4');
        headers.set('Content-Disposition', `attachment; filename="${title}.mp4"`);

        // Use NextResponse to stream the response
        return new NextResponse(videoStream as any, { headers });

    } catch (error: any) {
        console.error('Failed to download video:', error);
        return new NextResponse(error.message || 'Failed to download video', { status: 500 });
    }
}
