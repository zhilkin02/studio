'use client';
import { EditableText } from '@/components/editable-text';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase';
import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { Globe } from 'lucide-react';
import { Skeleton } from './ui/skeleton';


export function Footer() {
  const currentYear = new Date().getFullYear();
  const firestore = useFirestore();
  const contentDocRef = useMemo(() => firestore ? doc(firestore, 'site_content', 'main') : null, [firestore]);
  const { data: content, loading } = useDoc(contentDocRef, { listen: true });
  
  const socialLinks = content?.socialLinks || [];
  const creatorCredit = content?.creatorCredit || 'Создатель сайта Fox2099';
  const footerText = content?.footer_text || `© ${currentYear} Коротко О Не Коротком (КоНК). Все права защищены.`;

  return (
    <footer className="bg-muted border-t">
      <div className="container mx-auto px-4 py-6 text-muted-foreground flex flex-col items-center gap-4">
        {loading ? (
           <Skeleton className="h-6 w-72" />
        ): (
          socialLinks.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {socialLinks.map((link: {id: string, name: string, url: string}) => (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors">
                      {link.name}
                    </a>
                ))}
            </div>
          )
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
