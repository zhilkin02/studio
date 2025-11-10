"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function useSystemTheme() {
    const firestore = useFirestore();
    const { theme } = useTheme();
    
    const themeDocRef = React.useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'site_settings', 'theme');
    }, [firestore]);

    const { data: themeSettings } = useDoc(themeDocRef, { listen: true });

    React.useEffect(() => {
        if (theme === 'system' && themeSettings && document.documentElement) {
             const root = document.documentElement;
             const style = `
                --background: ${themeSettings.background || '240 5% 8%'};
                --foreground: ${themeSettings.foreground || '0 0% 98%'};
                --card: ${themeSettings.card || '240 5% 12%'};
                --card-foreground: ${themeSettings.cardForeground || '0 0% 98%'};
                --popover: ${themeSettings.popover || '240 5% 8%'};
                --popover-foreground: ${themeSettings.popoverForeground || '0 0% 98%'};
                --primary: ${themeSettings.primary || '262 80% 60%'};
                --primary-foreground: ${themeSettings.primaryForeground || '0 0% 98%'};
                --secondary: ${themeSettings.secondary || '240 5% 15%'};
                --secondary-foreground: ${themeSettings.secondaryForeground || '0 0% 98%'};
                --muted: ${themeSettings.muted || '240 5% 15%'};
                --muted-foreground: ${themeSettings.mutedForeground || '0 0% 63.9%'};
                --accent: ${themeSettings.accent || '190 95% 55%'};
                --accent-foreground: ${themeSettings.accentForeground || '240 5% 8%'};
                --destructive: ${themeSettings.destructive || '0 62.8% 30.6%'};
                --destructive-foreground: ${themeSettings.destructiveForeground || '0 0% 98%'};
                --border: ${themeSettings.border || '240 5% 20%'};
                --input: ${themeSettings.input || '240 5% 20%'};
                --ring: ${themeSettings.ring || '262 80% 60%'};
             `;
             root.style.cssText = style;
        } else if (theme === 'light' || theme === 'dark') {
            document.documentElement.style.cssText = '';
        }
    }, [theme, themeSettings]);
}


function ThemeController({ children }: { children: React.ReactNode}) {
    useSystemTheme();
    return <>{children}</>;
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
        <ThemeController>
            {children}
        </ThemeController>
    </NextThemesProvider>
  )
}
