'use client';
import { EditableText } from '@/components/editable-text';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-muted">
      <div className="container mx-auto px-4 py-6 text-center text-muted-foreground flex justify-center">
        <EditableText
          docPath="site_content/main"
          fieldKey="footer_text"
          defaultValue={`© ${currentYear} Коротко О Не Коротком (КоНК). Все права защищены.`}
          render={(text) => <p className="whitespace-pre-wrap">{text}</p>}
          textarea={true}
          className="relative"
        />
      </div>
    </footer>
  );
}
