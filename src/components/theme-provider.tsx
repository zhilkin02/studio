"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function CustomThemeApplier() {
    const firestore = useFirestore();
    const { theme } = useTheme();

    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    React.useEffect(() => {
        const root = document.documentElement;
        if (!root) return;

        const applyTheme = (settings: any) => {
            if (!settings) return;

            // Clear any previously applied inline styles to avoid conflicts
            root.style.cssText = '';

            Object.keys(settings).forEach(key => {
                 if (key.endsWith('Hex')) {
                    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase().replace('-hex', '')}`;
                    root.style.setProperty(cssVar, settings[key.replace('Hex', '')]);
                } else if (key.endsWith('Opacity')) {
                    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                    root.style.setProperty(cssVar, settings[key]);
                }
            });
        };
        
        if (theme === 'light' && lightThemeSettings) {
            applyTheme(lightThemeSettings);
        } else if (theme === 'dark' && darkThemeSettings) {
            applyTheme(darkThemeSettings);
        } else if (theme === 'system') {
            // For system theme, we need to know if the system is in light or dark mode
            const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (systemIsDark && darkThemeSettings) {
                applyTheme(darkThemeSettings);
            } else if (!systemIsDark && lightThemeSettings) {
                 applyTheme(lightThemeSettings);
            } else {
                 root.style.cssText = '';
            }
        }
        
    }, [theme, lightThemeSettings, darkThemeSettings]);

    return null;
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
        <CustomThemeApplier />
        {children}
    </NextThemesProvider>
  )
}
