"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function ThemeStyleApplicator() {
    const firestore = useFirestore();
    const { resolvedTheme } = useTheme();
    
    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    React.useEffect(() => {
        const root = document.documentElement;

        const clearCustomProperties = () => {
            const propertiesToRemove: string[] = [];
            for (let i = 0; i < root.style.length; i++) {
                const prop = root.style[i];
                if (prop.startsWith('--')) {
                    propertiesToRemove.push(prop);
                }
            }
            propertiesToRemove.forEach(prop => root.style.removeProperty(prop));
        }

        const applySettings = (settings: any) => {
            if (!settings) return;
            clearCustomProperties();
            Object.entries(settings).forEach(([key, value]) => {
                if (key.endsWith('Hex')) return; // Skip hex values
                if (value && typeof value === 'string') {
                    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                    root.style.setProperty(cssVar, value);
                } else if (value !== null && typeof value === 'number') {
                    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                    root.style.setProperty(cssVar, value.toString());
                }
            });
        };

        if (resolvedTheme === 'dark' && darkThemeSettings) {
            applySettings(darkThemeSettings);
        } else if (resolvedTheme === 'light' && lightThemeSettings) {
            applySettings(lightThemeSettings);
        } else {
             clearCustomProperties();
        }

    }, [resolvedTheme, lightThemeSettings, darkThemeSettings]);

    return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeStyleApplicator />
      {children}
    </NextThemesProvider>
  )
}
