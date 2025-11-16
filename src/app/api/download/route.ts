
import {NextRequest, NextResponse} from 'next/server';
import {youtubedl, YoutubedlError} from 'youtube-dl-exec';
import { Readable } from 'stream';
import path from 'path';

// Это важно для стриминга на Vercel
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({error: 'URL is required'}, {status: 400});
  }

  // Определяем путь к yt-dlp в зависимости от среды
  const ytDlpPath = process.env.NODE_ENV === 'development'
      // В режиме разработки, node_modules находится в корне проекта
      ? path.resolve(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp')
      // В продакшене на Vercel, node_modules находится в другом месте
      : path.resolve(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp');


  try {
    // Получаем информацию о видео, чтобы узнать его название
    const metadata = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      callHome: false,
      noCheckCertificates: true,
    });
    
    const title = (metadata as any).title || 'video';
    
    // Создаем "безопасное" имя файла
    const safeFilename = title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100);

    // Получаем поток (stream) видеофайла
    const videoStream = youtubedl.exec(videoUrl, {
      output: '-', // Выводить в stdout
      format: 'best[ext=mp4]', // Лучший mp4
      noWarnings: true,
      callHome: false,
      noCheckCertificates: true,
    }, { 
      stdio: ['ignore', 'pipe', 'ignore'], // stdin, stdout, stderr
      youtubeDlPath: ytDlpPath,
    });

    if (!videoStream.stdout) {
         throw new Error("Could not get video stream from youtube-dl-exec.");
    }
    
    // Преобразуем Node.js Stream в Web Stream
    const webStream = new ReadableStream({
      start(controller) {
        videoStream.stdout!.on('data', (chunk: Buffer) => {
          controller.enqueue(chunk);
        });
        videoStream.stdout!.on('end', () => {
          controller.close();
        });
        videoStream.stdout!.on('error', (err: Error) => {
          controller.error(err);
        });
        videoStream.on('error', (err: Error) => {
           controller.error(err);
        });
      },
      cancel() {
        videoStream.kill();
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
    console.error('yt-dlp error:', error);
    const errorMessage = error.stderr || error.message || 'Unknown error from yt-dlp';
    return NextResponse.json({error: `Failed to download video. ${errorMessage}`}, {status: 500});
  }
}
