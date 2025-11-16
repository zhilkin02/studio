import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';
import { YtDlpExec, YtDlpError } from 'yt-dlp-exec';

export const dynamic = 'force-dynamic';

async function validateYouTubeUrl(url: string | null): Promise<boolean> {
  if (!url) return false;
  // ytdl-core's validator is good enough for a basic check
  return ytdl.validateURL(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!await validateYouTubeUrl(videoUrl)) {
    return NextResponse.json({ error: 'A valid YouTube URL is required' }, { status: 400 });
  }

  try {
    // 1. Get metadata first to extract the title
    const metadata = await YtDlpExec.execPromise(videoUrl!, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });
    
    const title = metadata.title || 'video';
    const safeFilename = title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100);

    // 2. Execute yt-dlp again to get the video stream
    const videoStream = YtDlpExec(videoUrl!, {
      noCheckCertificates: true,
      noWarnings: true,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      output: '-', // Pipe to stdout
    });

    if (!videoStream.stdout) {
      throw new Error('Could not get video stream from yt-dlp');
    }

    // Convert Node.js Stream to Web Stream
    const webStream = new ReadableStream({
      start(controller) {
        videoStream.stdout.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        videoStream.stdout.on('end', () => {
          controller.close();
        });
        videoStream.on('error', (err) => {
          console.error('yt-dlp process error:', err);
          controller.error(err);
        });
         videoStream.stdout.on('error', (err) => {
          console.error('yt-dlp stdout error:', err);
          controller.error(err);
        });
      },
      cancel() {
        videoStream.kill();
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${safeFilename}.mp4"`,
      },
    });

  } catch (error: any) {
    console.error('yt-dlp error:', error);
    let errorMessage = 'Failed to process video.';
    if (error instanceof YtDlpError) {
        errorMessage = `yt-dlp failed: ${error.message}. Stderr: ${error.stderr}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
