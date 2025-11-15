import {NextRequest, NextResponse} from 'next/server';
import YTDlpWrap from 'yt-dlp-wrap';

// Это важно для стриминга на Vercel
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({error: 'URL is required'}, {status: 400});
  }

  try {
    const ytDlpWrap = new YTDlpWrap();
    
    // Получаем информацию о видео, чтобы узнать его название
    const metadata = await ytDlpWrap.getVideoInfo(videoUrl);
    const title = metadata.title || 'video';
    
    // Создаем "безопасное" имя файла
    const safeFilename = title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100);

    // Получаем поток (stream) видеофайла
    const videoStream = ytDlpWrap.execStream([
      videoUrl,
      '-f', // Формат
      'best[ext=mp4]', // Лучший mp4
      '--ignore-errors'
    ]);

    // Создаем стриминговый ответ
    return new Response(videoStream as any, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        // Этот заголовок говорит браузеру, что файл нужно скачать и как его назвать
        'Content-Disposition': `attachment; filename="${safeFilename}.mp4"`,
      },
    });
  } catch (error: any) {
    console.error('yt-dlp error:', error);
    return NextResponse.json({error: `Failed to download video: ${error.message}`}, {status: 500});
  }
}
