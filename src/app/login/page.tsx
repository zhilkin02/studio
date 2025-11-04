"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {

  // This component will be refactored to use Firebase Authentication.
  // The old form logic is being removed.

  return (
    <div className="flex justify-center items-center py-16">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">Вход</h1>
        <p className="text-center text-muted-foreground">Эта страница будет скоро обновлена для использования Firebase Authentication.</p>
        <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="admin@example.com"
                disabled
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input 
                id="password" 
                name="password" 
                type="password" 
                placeholder="********"
                disabled
            />
        </div>
        <Button type="submit" className="w-full" disabled>
          Войти
        </Button>
      </div>
    </div>
  );
}
