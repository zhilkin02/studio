export function Footer() {
  return (
    <footer className="bg-muted">
      <div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Коротко О Не Коротком (КоНК). Все права защищены.</p>
      </div>
    </footer>
  );
}
