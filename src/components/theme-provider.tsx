"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function createThemeCss(settings: any): string | null {
    if (!settings) return null;
    
    // This function now correctly handles both HSL strings and opacity numbers
    const props = Object.entries(settings)
        .map(([key, value]) => {
            if (key.endsWith('Hex')) {
                const baseKey = key.replace(/Hex$/, '');
                // Check if the HSL value exists. If not, this property will be skipped.
                if (settings[baseKey]) {
                     return `--${baseKey.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${settings[baseKey]}`;
                }
            } else if (key.endsWith('Opacity')) {
                 const baseKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                 return `--${baseKey}: ${value}`;
            }
            return null;
        })
        .filter(Boolean); // Filter out null values

    return props.join('; ');
}


function CustomThemeApplier() {
    const firestore = useFirestore();
    // useTheme() is now correctly used inside a child of NextThemesProvider
    const { theme } = useTheme();
    const [isMounted, setIsMounted] = React.useState(false);

    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    React.useEffect(() => {
        if (!isMounted) return;

        const lightThemeCss = createThemeCss(lightThemeSettings);
        const darkThemeCss = createThemeCss(darkThemeSettings);
        
        let lightStyleTag = document.getElementById('dynamic-light-theme');
        if (!lightStyleTag) {
            lightStyleTag = document.createElement('style');
            lightStyleTag.id = 'dynamic-light-theme';
            document.head.appendChild(lightStyleTag);
        }
        lightStyleTag.innerHTML = lightThemeCss ? `.light { ${lightThemeCss} }` : '';

        let darkStyleTag = document.getElementById('dynamic-dark-theme');
        if (!darkStyleTag) {
            darkStyleTag = document.createElement('style');
            darkStyleTag.id = 'dynamic-dark-theme';
            document.head.appendChild(darkStyleTag);
        }
        darkStyleTag.innerHTML = darkThemeCss ? `.dark { ${darkThemeCss} }` : '';
        
    // We listen to changes in settings and mounted state
    }, [isMounted, lightThemeSettings, darkThemeSettings]);

  return null; // This component does not render anything itself
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <CustomThemeApplier />
      {children}
    </NextThemesProvider>
  )
}
