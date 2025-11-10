"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function SystemThemeLoader() {
    const firestore = useFirestore();
    const { theme, systemTheme } = useTheme();
    
    const themeDocRef = React.useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'site_settings', 'theme');
    }, [firestore]);

    const { data: themeSettings } = useDoc(themeDocRef, { listen: true });

    React.useEffect(() => {
        // We only apply custom styles when the user has selected the "system" theme.
        if (theme !== 'system' || !themeSettings || !document.documentElement) {
            return;
        }

        const root = document.documentElement;

        const applyStyles = (settings: any) => {
             root.style.setProperty('--background', settings.background || '240 5% 8%');
             root.style.setProperty('--foreground', settings.foreground || '0 0% 98%');
             root.style.setProperty('--card', settings.card || '240 5% 12%');
             root.style.setProperty('--card-foreground', settings.cardForeground || '0 0% 98%');
             root.style.setProperty('--popover', settings.popover || '240 5% 8%');
             root.style.setProperty('--popover-foreground', settings.popoverForeground || '0 0% 98%');
             root.style.setProperty('--primary', settings.primary || '262 80% 60%');
             root.style.setProperty('--primary-foreground', settings.primaryForeground || '0 0% 98%');
             root.style.setProperty('--secondary', settings.secondary || '240 5% 15%');
             root.style.setProperty('--secondary-foreground', settings.secondaryForeground || '0 0% 98%');
             root.style.setProperty('--muted', settings.muted || '240 5% 15%');
             root.style.setProperty('--muted-foreground', settings.mutedForeground || '0 0% 63.9%');
             root.style.setProperty('--accent', settings.accent || '190 95% 55%');
             root.style.setProperty('--accent-foreground', settings.accentForeground || '240 5% 8%');
             root.style.setProperty('--destructive', settings.destructive || '0 62.8% 30.6%');
             root.style.setProperty('--destructive-foreground', settings.destructiveForeground || '0 0% 98%');
             root.style.setProperty('--border', settings.border || '240 5% 20%');
             root.style.setProperty('--input', settings.input || '240 5% 20%');
             root.style.setProperty('--ring', settings.ring || '262 80% 60%');
             
             // Opacity variables
             root.style.setProperty('--background-opacity', (settings.backgroundOpacity ?? 1).toString());
             root.style.setProperty('--card-opacity', (settings.cardOpacity ?? 1).toString());
             root.style.setProperty('--popover-opacity', (settings.popoverOpacity ?? 1).toString());
             root.style.setProperty('--muted-opacity', (settings.mutedOpacity ?? 1).toString());
             root.style.setProperty('--primary-opacity', (settings.primaryOpacity ?? 1).toString());
        };

        applyStyles(themeSettings);
        
        // next-themes applies the 'dark' or 'light' class based on system preference
        // when theme is 'system'. We apply our custom theme on top of that.
        // We don't want to clear styles when the underlying system theme changes.
        // This effect should only re-run if the user-selected theme or the settings from Firestore change.

    }, [theme, themeSettings]);

    // This effect is responsible for CLEARING styles when switching AWAY from system theme.
    React.useEffect(() => {
        if (theme === 'light' || theme === 'dark') {
            document.documentElement.style.cssText = '';
        }
    }, [theme]);


    return null; // This component doesn't render anything
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
        {children}
        <SystemThemeLoader />
    </NextThemesProvider>
  )
}
