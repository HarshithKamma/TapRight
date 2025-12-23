// Palette Definitions
const LightColors = {
    // Warm Light Theme (Cream/Dark Stone)
    background: '#FDFBF7', // Warm Off-White
    surface: '#FFFFFF',    // Pure White
    surfaceSoft: '#F3F4F6', // Light Grey
    surfaceHighlight: '#E5E7EB', // Grey 200
    surfaceMuted: '#F9FAFB',
    surfaceLight: '#F3F4F6',

    // Accents (Dark Stone/Glow)
    accent: '#1c1917',     // Dark Stone 900 (Buttons)
    accentMuted: '#292524', // Stone 800
    accentSoft: 'rgba(28, 25, 23, 0.1)', // Subtle Dark Overlay

    // Text
    textPrimary: '#1c1917', // Dark Stone (High Contrast)
    textSecondary: '#57534e', // Stone 500
    placeholder: '#a8a29e', // Stone 400

    // Functional
    border: '#E5E7EB',      // Grey 200
    success: '#22c55e',     // Green 500
    warning: '#f59e0b',     // Amber 500
    error: '#ef4444',       // Red 500
    shadow: '#000000',
};

const DarkColors = {
    // Dark Theme (Deep Stone/off-black)
    background: '#0c0a09', // Stone 950
    surface: '#1c1917',    // Stone 900
    surfaceSoft: '#292524', // Stone 800
    surfaceHighlight: '#44403c', // Stone 700
    surfaceMuted: '#1c1917',
    surfaceLight: '#292524',

    // Accents
    accent: '#FFFFFF',     // White for contrast on dark
    accentMuted: '#e7e5e4', // Stone 200
    accentSoft: 'rgba(255, 255, 255, 0.1)', // Subtle Light Overlay

    // Text
    textPrimary: '#FFFFFF', // White
    textSecondary: '#a8a29e', // Stone 400
    placeholder: '#78716c', // Stone 500

    // Functional
    border: '#292524',      // Stone 800
    success: '#22c55e',     // Green 500 (Keep)
    warning: '#fbbf24',     // Amber 400 (Brighter for dark mode)
    error: '#ef4444',       // Red 500
    shadow: '#000000',
};

export const COLORS = LightColors; // Default/Fallback
export { LightColors, DarkColors };

