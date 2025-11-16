
import { NextRequest, NextResponse } from 'next/server';
import * as YtDlpExec from 'yt-dlp-exec';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

async function validateYouTubeUrl(url: string | null): Promise<boolean> {
  if (!url) return false;
  // A simple regex check is good enough for a basic validation
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  return youtubeRegex.test(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!await validateYouTubeUrl(videoUrl)) {
    return NextResponse.json({ error: 'A valid YouTube URL is required' }, { status: 400 });
  }

  try {
    // 1. Get metadata first to extract the title
    const metadata = await YtDlpExec.default(videoUrl!, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });
    
    const title = metadata.title || 'video';
    const safeFilename = title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100);

    // 2. Execute yt-dlp again to get the video stream
    const videoStreamProcess = YtDlpExec.exec(videoUrl!, {
      noCheckCertificate: true,
      noWarnings: true,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      output: '-', // Pipe to stdout
    });

    if (!videoStreamProcess.stdout) {
      throw new Error('Could not get video stream from yt-dlp');
    }

    // Convert Node.js Stream to Web Stream
    const webStream = new ReadableStream({
      start(controller) {
        if (!videoStreamProcess.stdout) {
          controller.error(new Error('Stdout is not available'));
          return;
        }

        videoStreamProcess.stdout.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        videoStreamProcess.stdout.on('end', () => {
          controller.close();
        });
        videoStreamProcess.on('error', (err) => {
          console.error('yt-dlp process error:', err);
          controller.error(err);
        });
         videoStreamProcess.stdout.on('error', (err) => {
          console.error('yt-dlp stdout error:', err);
          controller.error(err);
        });
      },
      cancel() {
        videoStreamProcess.kill();
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
    if (error instanceof YtDlpExec.YtDlpError) {
        errorMessage = `yt-dlp failed: ${error.message}. Stderr: ${error.stderr}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
