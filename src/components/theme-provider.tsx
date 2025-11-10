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
             const root = document.documentElement.style;
             root.setProperty('--background', themeSettings.background || '240 5% 8%');
             root.setProperty('--foreground', themeSettings.foreground || '0 0% 98%');
             root.setProperty('--card', themeSettings.card || '240 5% 12%');
             root.setProperty('--card-foreground', themeSettings.cardForeground || '0 0% 98%');
             root.setProperty('--popover', themeSettings.popover || '240 5% 8%');
             root.setProperty('--popover-foreground', themeSettings.popoverForeground || '0 0% 98%');
             root.setProperty('--primary', themeSettings.primary || '262 80% 60%');
             root.setProperty('--primary-foreground', themeSettings.primaryForeground || '0 0% 98%');
             root.setProperty('--secondary', themeSettings.secondary || '240 5% 15%');
             root.setProperty('--secondary-foreground', themeSettings.secondaryForeground || '0 0% 98%');
             root.setProperty('--muted', themeSettings.muted || '240 5% 15%');
             root.setProperty('--muted-foreground', themeSettings.mutedForeground || '0 0% 63.9%');
             root.setProperty('--accent', themeSettings.accent || '190 95% 55%');
             root.setProperty('--accent-foreground', themeSettings.accentForeground || '240 5% 8%');
             root.setProperty('--destructive', themeSettings.destructive || '0 62.8% 30.6%');
             root.setProperty('--destructive-foreground', themeSettings.destructiveForeground || '0 0% 98%');
             root.setProperty('--border', themeSettings.border || '240 5% 20%');
             root.setProperty('--input', themeSettings.input || '240 5% 20%');
             root.setProperty('--ring', themeSettings.ring || '262 80% 60%');
             // Opacity variables
             root.setProperty('--background-opacity', (themeSettings.backgroundOpacity ?? 1).toString());
             root.setProperty('--card-opacity', (themeSettings.cardOpacity ?? 1).toString());
             root.setProperty('--popover-opacity', (themeSettings.popoverOpacity ?? 1).toString());
             root.setProperty('--muted-opacity', (themeSettings.mutedOpacity ?? 1).toString());
             root.setProperty('--primary-opacity', (themeSettings.primaryOpacity ?? 1).toString());
        } else if (theme === 'light' || theme === 'dark') {
            // When not in system theme, remove the inline styles to let the CSS classes take over.
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
