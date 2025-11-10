"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function createThemeCss(settings: any): string | null {
    if (!settings) return null;
    
    // Ensure all values exist to prevent "undefined" in CSS
    const props = [
        settings.background ? `--background: ${settings.background}` : null,
        settings.foreground ? `--foreground: ${settings.foreground}` : null,
        settings.card ? `--card: ${settings.card}` : null,
        settings.cardForeground ? `--card-foreground: ${settings.cardForeground}` : null,
        settings.popover ? `--popover: ${settings.popover}` : null,
        settings.popoverForeground ? `--popover-foreground: ${settings.popoverForeground}` : null,
        settings.primary ? `--primary: ${settings.primary}` : null,
        settings.primaryForeground ? `--primary-foreground: ${settings.primaryForeground}` : null,
        settings.secondary ? `--secondary: ${settings.secondary}` : null,
        settings.secondaryForeground ? `--secondary-foreground: ${settings.secondaryForeground}` : null,
        settings.muted ? `--muted: ${settings.muted}` : null,
        settings.mutedForeground ? `--muted-foreground: ${settings.mutedForeground}` : null,
        settings.accent ? `--accent: ${settings.accent}` : null,
        settings.accentForeground ? `--accent-foreground: ${settings.accentForeground}` : null,
        settings.destructive ? `--destructive: ${settings.destructive}` : null,
        settings.destructiveForeground ? `--destructive-foreground: ${settings.destructiveForeground}` : null,
        settings.border ? `--border: ${settings.border}` : null,
        settings.input ? `--input: ${settings.input}` : null,
        settings.ring ? `--ring: ${settings.ring}` : null,
        settings.backgroundOpacity !== undefined ? `--background-opacity: ${settings.backgroundOpacity}` : null,
        settings.cardOpacity !== undefined ? `--card-opacity: ${settings.cardOpacity}` : null,
        settings.popoverOpacity !== undefined ? `--popover-opacity: ${settings.popoverOpacity}` : null,
        settings.mutedOpacity !== undefined ? `--muted-opacity: ${settings.mutedOpacity}` : null,
        settings.primaryOpacity !== undefined ? `--primary-opacity: ${settings.primaryOpacity}` : null,
    ];

    return props.filter(Boolean).join('; ');
}


function DynamicThemeInjector() {
    const firestore = useFirestore();

    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    const [isMounted, setIsMounted] = React.useState(false);
    
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const lightThemeCss = React.useMemo(() => createThemeCss(lightThemeSettings), [lightThemeSettings]);
    const darkThemeCss = React.useMemo(() => createThemeCss(darkThemeSettings), [darkThemeSettings]);

    // We only render the style tags on the client after mounting to avoid hydration mismatch errors.
    if (!isMounted) {
        return null;
    }

    return (
      <>
        {lightThemeCss && 
            <style id="dynamic-light-theme" dangerouslySetInnerHTML={{
                __html: `.light { ${lightThemeCss} }`
            }}/>
        }
        {darkThemeCss && 
            <style id="dynamic-dark-theme" dangerouslySetInnerHTML={{
                __html: `.dark { ${darkThemeCss} }`
            }}/>
        }
      </>
    )
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      {children}
      <DynamicThemeInjector />
    </NextThemesProvider>
  )
}
