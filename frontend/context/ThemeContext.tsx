import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors } from '../constants/Colors';

type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: ThemeType;
    setTheme: (theme: ThemeType) => void;
    colors: typeof LightColors;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'system',
    setTheme: () => { },
    colors: LightColors,
    isDark: false,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemScheme = useColorScheme();
    const [theme, setTheme] = useState<ThemeType>('system');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load saved theme on mount
    useEffect(() => {
        (async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('user_theme');
                if (savedTheme) {
                    setTheme(savedTheme as ThemeType);
                }
            } catch (e) {
                console.error('Failed to load theme', e);
            } finally {
                setIsLoaded(true);
            }
        })();
    }, []);

    // Save theme when changed
    const handleSetTheme = async (newTheme: ThemeType) => {
        setTheme(newTheme);
        try {
            await AsyncStorage.setItem('user_theme', newTheme);
        } catch (e) {
            console.error('Failed to save theme', e);
        }
    };

    const isDark = theme === 'system' ? systemScheme === 'dark' : theme === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    if (!isLoaded) {
        // Return a minimal loading screen to avoid flash of no content
        return (
            <View style={{ flex: 1, backgroundColor: LightColors.background }} />
        );
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, colors, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
