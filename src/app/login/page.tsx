"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      // TODO: Replace with your actual Cloud Function URL after deployment
      const functionUrl = "https://login-vkiq5a4qla-uc.a.run.app"; // This is a placeholder
      
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ошибка входа. Попробуйте снова.");
      }

      // Store session in a cookie
      document.cookie = `session=${data.session}; path=/; max-age=86400; SameSite=Lax`;

      toast({
        title: "Успешный вход!",
        description: "Вы вошли как администратор.",
      });
      router.push("/"); // Redirect to home page
      router.refresh(); // Refresh to update header state

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка входа",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">Вход для администратора</h1>
        <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input 
                id="password" 
                name="password" 
                type="password" 
                required 
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
            />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Вход..." : "Войти"}
        </Button>
      </form>
    </div>
  );
}
