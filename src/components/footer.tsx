'use client';
import { EditableText } from '@/components/editable-text';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase';
import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { Globe, Youtube } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  vk: ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
      <path fill="currentColor" d="M448 56.7v398.6c0 13.7-11.1 24.7-24.7 24.7H24.7C11.1 480 0 468.9 0 455.3V56.7C0 43.1 11.1 32 24.7 32h398.6c13.6 0 24.7 11.1 24.7 24.7zM288.6 354.3c21.8-15.3 35.1-37.5 35.1-62.9 0-14.1-2.9-27.2-8.2-39.3-6-13.3-15.2-24.3-26.9-33.1-11.2-8.4-24.3-15-39.3-19.8v-1.6c13.5-4.4 25.3-11.1 35.3-20.1 10-9 18.2-20.1 24.6-33.3 6.3-13.2 9.5-27.9 9.5-44.1 0-16.5-3.6-31.8-10.8-45.8-7.2-14.1-17.7-25.9-31.5-35.4-13.7-9.6-30.2-14.3-49.4-14.3h-110v288h102.3c16.5 0 31.9-2.9 46.2-8.7zm-113-240h51.5c9.2 0 16.7 1.8 22.5 5.5s8.7 8.9 8.7 15.7c0 8.4-2.8 15-8.3 19.8-5.5 4.7-13.2 7.1-23.1 7.1h-51.3v-48.1zm52.3 192h-52.3v-96h55c11.7 0 21.2 2.6 28.5 7.8 7.3 5.2 11 12.8 11 22.8 0 10.9-3.7 19.6-11.1 26.1-7.4 6.5-17.3 9.8-29.8 9.8z"/>
    </svg>
  ),
  youtube: Youtube,
  kick: ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 288">
      <path fill="currentColor" d="M112 32v64H48v64H0V32h112zm144 32v192h-80v-64h-64V32h144zM48 192h64v64H0V128h48v64z"/>
    </svg>
  ),
  'vk live': ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="currentColor" d="M12.01 20.25q-1.562 0-2.836-.58t-2.224-1.58q-1.636-1.636-2.31-3.923T4.05 9.7V9.525q0-1.875.938-3.41T7.3 3.8L12 1.5l4.7 2.3q1.325 1.287 2.263 2.824T19.95 9.525V9.7q0 2.212-.663 4.467t-2.321 3.923q-.948.988-2.224 1.58t-2.836.58m-.005-1.5q2.55 0 4.56-1.537t2.81-4.25q.412-1.35.619-2.738T17.25 9.7V9.525q0-1.2-.6-2.262t-1.65-1.788L12 3.6l-3 1.875q-1.05.725-1.65 1.788T6.75 9.525V9.7q0 1.225.206 2.613t.619 2.737q.8 2.713 2.81 4.25T11.995 18.75m.01-6.137Z"/>
    </svg>
  )
};


export function Footer() {
  const currentYear = new Date().getFullYear();
  const firestore = useFirestore();
  const contentDocRef = useMemo(() => firestore ? doc(firestore, 'site_content', 'main') : null, [firestore]);
  const { data: content, loading } = useDoc(contentDocRef, { listen: true });
  
  const defaultSocials = [
      { id: '1', name: 'vk', url: 'https://vk.com/kkonk' },
      { id: '2', name: 'youtube', url: 'https://www.youtube.com/@KorotkoONeKorotkom' },
      { id: '3', name: 'kick', url: 'https://kick.com/korotkokonk' },
      { id: '4', name: 'vk live', url: 'https://live.vkvideo.ru/konk' },
  ];

  const socialLinks = content?.socialLinks || defaultSocials;
  const creatorCredit = content?.creatorCredit || 'Создатель сайта Fox2099';
  const footerText = content?.footer_text || `© ${currentYear} Коротко О Не Коротком (КоНК). Все права защищены.`;

  return (
    <footer className="bg-muted border-t">
      <div className="container mx-auto px-4 py-6 text-muted-foreground flex flex-col items-center gap-4">
        {loading ? (
           <Skeleton className="h-8 w-48" />
        ): (
          <div className="flex gap-4">
              {socialLinks.map((link: {id: string, name: string, url: string}) => {
                const Icon = iconMap[link.name.toLowerCase()] || Globe;
                return (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Icon className="h-6 w-6" />
                    <span className="sr-only">{link.name}</span>
                  </a>
                )
              })}
          </div>
        )}
        <div className="text-center text-sm">
          <EditableText
            docPath="site_content/main"
            fieldKey="footer_text"
            defaultValue={footerText}
            render={(text) => <p className="whitespace-pre-wrap">{text}</p>}
            textarea={true}
            className="relative"
          />
           <EditableText
            docPath="site_content/main"
            fieldKey="creatorCredit"
            defaultValue={creatorCredit}
            render={(text) => <p className="whitespace-pre-wrap text-xs mt-1">{text}</p>}
            textarea={false}
            className="relative"
          />
        </div>
      </div>
    </footer>
  );
}
