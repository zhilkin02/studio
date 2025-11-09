import type {Metadata} from 'next';
import './globals.css';
import {Header} from '@/components/header';
import {Footer} from '@/components/footer';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider, initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Suspense } from 'react';


export const metadata: Metadata = {
  title: 'КоНК - Коротко О Не Коротком',
  description: 'Поиск фрагментов из фильмов и сериалов',
};

async function ThemeLoader() {
  // We initialize a temporary instance here on the server to fetch the theme.
  // This doesn't affect the client-side singleton initialization.
  const { firestore } = initializeFirebase();
  const themeDocRef = doc(firestore, 'site_settings', 'theme');
  
  try {
    const themeDoc = await getDoc(themeDocRef);
    if (themeDoc.exists()) {
      const theme = themeDoc.data();
      const style = `
        :root {
          ${theme.background ? `--background: ${theme.background};` : ''}
          ${theme.primary ? `--primary: ${theme.primary};` : ''}
          ${theme.accent ? `--accent: ${theme.accent};` : ''}
          ${theme.headerImageUrl ? `--header-image-url: url(${theme.headerImageUrl});` : ''}
          ${theme.mainImageUrl ? `--main-image-url: url(${theme.mainImageUrl});` : ''}
          ${theme.footerImageUrl ? `--footer-image-url: url(${theme.footerImageUrl});` : ''}
        }
        .dark {
           ${theme.background ? `--background: ${theme.background};` : ''}
           ${theme.primary ? `--primary: ${theme.primary};` : ''}
           ${theme.accent ? `--accent: ${theme.accent};` : ''}
           ${theme.headerImageUrl ? `--header-image-url: url(${theme.headerImageUrl});` : ''}
           ${theme.mainImageUrl ? `--main-image-url: url(${theme.mainImageUrl});` : ''}
           ${theme.footerImageUrl ? `--footer-image-url: url(${theme.footerImageUrl});` : ''}
        }
      `;
      return <style>{style}</style>;
    }
  } catch (error) {
    console.error("Failed to load theme from Firestore:", error);
  }
  
  return null;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <Suspense fallback={null}>
          <ThemeLoader />
        </Suspense>
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <FirebaseClientProvider>
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
