"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { doc } from "firebase/firestore"
import { useFirestore } from "@/firebase"

function setCssVariables(theme: 'light' | 'dark', settings: any) {
    if (!settings) return;
    const root = document.documentElement;

    const themePrefix = `.${theme}`;
    const styleId = `dynamic-${theme}-theme-styles`;
    
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }

    const cssVars = [
        `--background: ${settings.background}`,
        `--foreground: ${settings.foreground}`,
        `--card: ${settings.card}`,
        `--card-foreground: ${settings.cardForeground}`,
        `--popover: ${settings.popover}`,
        `--popover-foreground: ${settings.popoverForeground}`,
        `--primary: ${settings.primary}`,
        `--primary-foreground: ${settings.primaryForeground}`,
        `--secondary: ${settings.secondary}`,
        `--secondary-foreground: ${settings.secondaryForeground}`,
        `--muted: ${settings.muted}`,
        `--muted-foreground: ${settings.mutedForeground}`,
        `--accent: ${settings.accent}`,
        `--accent-foreground: ${settings.accentForeground}`,
        `--destructive: ${settings.destructive}`,
        `--destructive-foreground: ${settings.destructiveForeground}`,
        `--border: ${settings.border}`,
        `--input: ${settings.input}`,
        `--ring: ${settings.ring}`,
        `--background-opacity: ${settings.backgroundOpacity ?? 1}`,
        `--card-opacity: ${settings.cardOpacity ?? 1}`,
        `--popover-opacity: ${settings.popoverOpacity ?? 1}`,
        `--muted-opacity: ${settings.mutedOpacity ?? 1}`,
        `--primary-opacity: ${settings.primaryOpacity ?? 1}`,
    ].filter(Boolean).join('; ');
    
    styleTag.innerHTML = `${themePrefix} { ${cssVars} }`;
}


function CustomThemeApplier() {
    const firestore = useFirestore();
    const { theme, systemTheme } = useTheme();

    const lightThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const darkThemeRef = React.useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);

    const { data: lightThemeSettings } = useDoc(lightThemeRef, { listen: true });
    const { data: darkThemeSettings } = useDoc(darkThemeRef, { listen: true });

    React.useEffect(() => {
        setCssVariables('light', lightThemeSettings);
    }, [lightThemeSettings]);

    React.useEffect(() => {
        setCssVariables('dark', darkThemeSettings);
    }, [darkThemeSettings]);
    
    return null;
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      {children}
      <CustomThemeApplier />
    </NextThemesProvider>
  )
}
