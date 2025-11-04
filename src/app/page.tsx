import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <section className="text-center py-16">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          Коротко О Не Коротком
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8">
          Найдите идеальный фрагмент из фильма или сериала за секунды.
        </p>
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            type="search"
            placeholder="Введите ключевые слова, название фильма или описание..."
            className="flex-grow"
          />
          <Button type="submit">
            <Search className="mr-2 h-4 w-4" /> Поиск
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Популярные клипы</h2>
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">Видеоклипы скоро появятся здесь.</p>
        </div>
      </section>
    </div>
  );
}
