import { UploadForm } from './upload-form';

export default function UploadPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Загрузить новое видео</h1>
      <UploadForm />
    </div>
  );
}
