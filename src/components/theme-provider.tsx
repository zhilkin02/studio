"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
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


function CustomThemeApplier() {
    const firestore = useFirestore();

    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    const lightThemeCss = React.useMemo(() => generateThemeCss(lightThemeSettings), [lightThemeSettings]);
    const darkThemeCss = React.useMemo(() => generateThemeCss(darkThemeSettings), [darkThemeSettings]);

    return (
      <>
        <style id="light-theme-vars">
            {lightThemeCss && `.light { ${lightThemeCss} }`}
        </style>
        <style id="dark-theme-vars">
            {darkThemeCss && `.dark { ${darkThemeCss} }`}
        </style>
      </>
    );
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
        <CustomThemeApplier />
        {children}
    </NextThemesProvider>
  )
}
