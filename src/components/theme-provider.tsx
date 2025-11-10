"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function CustomThemeApplier() {
    const firestore = useFirestore();
    const { theme, systemTheme } = useTheme();

    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    React.useEffect(() => {
        const root = document.documentElement;
        if (!root) return;

        const applyTheme = (settings: any) => {
            if (!settings) return;
            
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

        const clearTheme = () => {
             // Resets inline styles to allow CSS classes to take over
             root.style.cssText = '';
        }

        const effectiveTheme = theme === 'system' ? systemTheme : theme;
        
        if (effectiveTheme === 'light' && lightThemeSettings) {
            applyTheme(lightThemeSettings);
        } else if (effectiveTheme === 'dark' && darkThemeSettings) {
            applyTheme(darkThemeSettings);
        } else {
            clearTheme();
        }
        
    }, [theme, systemTheme, lightThemeSettings, darkThemeSettings]);

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
