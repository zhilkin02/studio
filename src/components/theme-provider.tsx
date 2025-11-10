"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function generateThemeCss(themeSettings: any): string {
    if (!themeSettings) return "";

    const cssVars = [
        `--background: ${themeSettings.background}`,
        `--foreground: ${themeSettings.foreground}`,
        `--card: ${themeSettings.card}`,
        `--card-foreground: ${themeSettings.cardForeground}`,
        `--popover: ${themeSettings.popover}`,
        `--popover-foreground: ${themeSettings.popoverForeground}`,
        `--primary: ${themeSettings.primary}`,
        `--primary-foreground: ${themeSettings.primaryForeground}`,
        `--secondary: ${themeSettings.secondary}`,
        `--secondary-foreground: ${themeSettings.secondaryForeground}`,
        `--muted: ${themeSettings.muted}`,
        `--muted-foreground: ${themeSettings.mutedForeground}`,
        `--accent: ${themeSettings.accent}`,
        `--accent-foreground: ${themeSettings.accentForeground}`,
        `--destructive: ${themeSettings.destructive}`,
        `--destructive-foreground: ${themeSettings.destructiveForeground}`,
        `--border: ${themeSettings.border}`,
        `--input: ${themeSettings.input}`,
        `--ring: ${themeSettings.ring}`,
    ].filter(Boolean).join('; ');

    const opacityVars = [
        `--background-opacity: ${themeSettings.backgroundOpacity ?? 1}`,
        `--card-opacity: ${themeSettings.cardOpacity ?? 1}`,
        `--popover-opacity: ${themeSettings.popoverOpacity ?? 1}`,
        `--muted-opacity: ${themeSettings.mutedOpacity ?? 1}`,
        `--primary-opacity: ${themeSettings.primaryOpacity ?? 1}`,
    ].filter(v => v.includes('undefined') === false).join('; ');

    return `${cssVars}; ${opacityVars};`;
}

function ThemeApplicator({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();

    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    React.useEffect(() => {
        const lightThemeCss = generateThemeCss(lightThemeSettings);
        let lightStyleTag = document.getElementById('light-theme-vars');
        if (!lightStyleTag) {
            lightStyleTag = document.createElement('style');
            lightStyleTag.id = 'light-theme-vars';
            document.head.appendChild(lightStyleTag);
        }
        lightStyleTag.innerHTML = lightThemeCss ? `.light { ${lightThemeCss} }` : '';

    }, [lightThemeSettings]);

    React.useEffect(() => {
        const darkThemeCss = generateThemeCss(darkThemeSettings);
        let darkStyleTag = document.getElementById('dark-theme-vars');
        if (!darkStyleTag) {
            darkStyleTag = document.createElement('style');
            darkStyleTag.id = 'dark-theme-vars';
            document.head.appendChild(darkStyleTag);
        }
        darkStyleTag.innerHTML = darkThemeCss ? `.dark { ${darkThemeCss} }` : '';
    }, [darkThemeSettings]);


    return <>{children}</>;
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeApplicator>{children}</ThemeApplicator>
    </NextThemesProvider>
  )
}
