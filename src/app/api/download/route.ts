import {NextRequest, NextResponse} from 'next/server';
import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';

// Это важно для стриминга на Vercel
export const dynamic = 'force-dynamic';

async function getYouTubeDlpPath() {
    // В среде Vercel мы можем писать только в /tmp
    const tmpDir = '/tmp';
    const binaryPath = path.join(tmpDir, 'yt-dlp_linux'); // Используем имя бинарника для Linux
    try {
        // Указываем, что нужно скачать бинарный файл для Linux
        await YTDlpWrap.downloadFromGithub(binaryPath, undefined, 'yt-dlp_linux');
        return binaryPath;
    } catch (e) {
        // Если скачивание не удалось, возможно, файл уже существует (например, из-за кеширования Vercel)
        // Пробуем использовать его. Если и это не сработает, то ошибка выйдет наружу.
        console.warn("Failed to download yt-dlp, attempting to use existing binary if available.", e);
        return 'yt-dlp'; // Фоллбэк на случай, если он как-то есть в PATH
    }
}


export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({error: 'URL is required'}, {status: 400});
  }

  try {
    const ytDlpPath = await getYouTubeDlpPath();
    const ytDlpWrap = new YTDlpWrap(ytDlpPath);
    
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
    // Более детальное логирование ошибки
    const errorMessage = error.message || 'Unknown error';
    const errorStderr = error.stderr || 'No stderr';
    return NextResponse.json({error: `Failed to download video: ${errorMessage}`, stderr: errorStderr}, {status: 500});
  }
}
