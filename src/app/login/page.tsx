"use client";

import { useFormState } from "react-dom";
import { login } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function LoginPage() {
  const { toast } = useToast();
  const [state, formAction] = useFormState(login, null);

  useEffect(() => {
    if (state?.error) {
      toast({
        variant: "destructive",
        title: "Ошибка входа",
        description: state.error,
      });
    }
  }, [state, toast]);


  return (
    <div className="flex justify-center items-center py-16">
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">Вход для администратора</h1>
        <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input 
                id="password" 
                name="password" 
                type="password" 
                required 
                placeholder="********"
            />
        </div>
        <Button type="submit" className="w-full">
          Войти
        </Button>
      </form>
    </div>
  );
}
