require('dotenv').config({ path: './.env.local' });
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' ,
        hostname: 'yt3.googleusercontent.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  // Make environment variables available on the server.
  serverRuntimeConfig: {
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
    YOUTUBE_REFRESH_TOKEN: process.env.YOUTUBE_REFRESH_TOKEN,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
  },
};

export default nextConfig;
