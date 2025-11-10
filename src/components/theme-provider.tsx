"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function applyTheme(settings: any) {
  if (!settings || typeof document === 'undefined') return;

  Object.entries(settings).forEach(([key, value]) => {
    if (key.endsWith('Hex')) return; // Skip hex values
    if (value && typeof value === 'string') {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      document.documentElement.style.setProperty(cssVar, value);
    } else if (value && typeof value === 'number') {
        const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        document.documentElement.style.setProperty(cssVar, value.toString());
    }
  });
}

function clearTheme() {
    if (typeof document === 'undefined') return;
    const style = document.documentElement.style;
    const propertiesToRemove: string[] = [];

    for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if(prop.startsWith('--')) {
             propertiesToRemove.push(prop);
        }
    }
    propertiesToRemove.forEach(prop => style.removeProperty(prop));
}


function ThemeStyleApplicator() {
    const firestore = useFirestore();
    const { resolvedTheme } = useTheme();
    
    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    React.useEffect(() => {
        clearTheme(); // Clear old styles before applying new ones
        if (resolvedTheme === 'dark' && darkThemeSettings) {
            applyTheme(darkThemeSettings);
        } else if (resolvedTheme === 'light' && lightThemeSettings) {
            applyTheme(lightThemeSettings);
        }
        
        // This effect should re-run whenever the theme or the settings change.
    }, [resolvedTheme, lightThemeSettings, darkThemeSettings]);

    return null; // This component does not render anything.
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeStyleApplicator />
      {children}
    </NextThemesProvider>
  )
}
