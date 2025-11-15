import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

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

    // Выбираем формат, который содержит и видео, и аудио. 720p - хороший компромисс.
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: (f) => f.container === 'mp4' && !!f.hasAudio && !!f.hasVideo,
    });
    
    // Если комбинированный формат не найден, пытаемся найти лучший из доступных.
    if (!format) {
       const fallbackFormat = ytdl.chooseFormat(info.formats, { quality: 'highest' });
        if (!fallbackFormat) {
          return new NextResponse('Could not find any suitable video format.', { status: 500 });
        }
        // Сообщаем пользователю, что может быть проблема с аудио/видео
        console.warn(`Could not find a combined format for ${videoId}. Falling back to highest quality format without guaranteed audio/video.`);
    }

    const videoStreamUrl = format.url;

    // Получаем видеопоток напрямую через fetch, что более надежно в serverless-среде
    const response = await fetch(videoStreamUrl);

    if (!response.ok || !response.body) {
        throw new Error('Failed to fetch video stream from YouTube.');
    }
    
    const safeTitle = (title).replace(/[^a-z0-9_ -]/gi, '_');
    const filename = `${safeTitle}.mp4`;

    // Создаем заголовки для ответа
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Type', 'video/mp4');
    
    // Передаем поток напрямую в ответ
    return new NextResponse(response.body, { headers });

  } catch (error: any) {
    console.error(`Error processing download for video ID ${videoId}:`, error);
    const errorMessage = error.message || 'An unknown error occurred';
    return new NextResponse(
        `Failed to download video. Reason: ${errorMessage}`, 
        { status: 500 }
    );
  }
}
