import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

// Это важно для стриминга на Vercel
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl || !ytdl.validateURL(videoUrl)) {
    return NextResponse.json({ error: 'A valid YouTube URL is required' }, { status: 400 });
  }

  try {
    const info = await ytdl.getInfo(videoUrl);
    const title = info.videoDetails.title;

    // Создаем "безопасное" имя файла
    const safeFilename = title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100) || 'video';

    const videoStream = ytdl(videoUrl, {
      quality: 'highestvideo',
      filter: 'videoandaudio',
    });

    // Преобразуем Node.js Stream в Web Stream, который понимает Next.js/Vercel
    const webStream = new ReadableStream({
      start(controller) {
        videoStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        videoStream.on('end', () => {
          controller.close();
        });
        videoStream.on('error', (err) => {
          console.error('ytdl stream error:', err);
          controller.error(err);
        });
      },
      cancel() {
        videoStream.destroy();
      },
    });

    // Создаем стриминговый ответ
    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${safeFilename}.mp4"`,
      },
    });

  } catch (error: any) {
    console.error('ytdl error:', error);
    return NextResponse.json(
      { error: `Failed to download video. ${error.message || 'Unknown error from ytdl-core'}` },
      { status: 500 }
    );
  }
}