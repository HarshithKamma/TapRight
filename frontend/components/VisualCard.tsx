import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/Colors';

interface VisualCardProps {
    name: string;
    issuer: string;
    color: string;
    rewards: { [key: string]: number };
    lastDigits?: string;
    scale?: number;
    highlightCategory?: string;
}

export default function VisualCard({ name, issuer, color, rewards, lastDigits = '••••', scale = 1, highlightCategory }: VisualCardProps) {
    // Generate gradient colors based on the primary color
    // We lighten/darken the provided hex to create a gradient
    // For now, let's use the provided color as the base and a slightly darker version for the bottom right
    const primaryColor = color || '#333';

    // Simple helper to darken a hex color
    const darken = (hex: string, percent: number) => {
        let num = parseInt(hex.replace('#', ''), 16);
        let amt = Math.round(2.55 * percent);
        let R = (num >> 16) - amt;
        let B = ((num >> 8) & 0x00FF) - amt;
        let G = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
    };

    const gradientColors = [primaryColor, darken(primaryColor, 40)];

    const getPrimaryReward = () => {
        // If a specific category is highlighted (e.g. from recommendation engine), show that first
        if (highlightCategory) {
            // Handle aliases or direct match
            const cat = highlightCategory.toLowerCase();
            let rate = rewards[cat] || 0;

            // Simple alias fallback if direct match fails
            if (!rate) {
                if (cat === 'rent') rate = rewards['rent'] || 1; // Bilt specific fallback
                else if (cat === 'everything') rate = rewards['everything'] || rewards['general'] || 1;
            }

            return `${rate}% ${highlightCategory}`;
        }

        const entries = Object.entries(rewards);
        if (entries.length === 0) return '';
        // Prioritize 'everything' if it's the only one, otherwise find max
        if (rewards.everything && entries.length === 1) return `${rewards.everything}% All`;

        // Find highest category
        const max = entries.reduce((a, b) => a[1] > b[1] ? a : b);
        return `${max[1]}% ${max[0].charAt(0).toUpperCase() + max[0].slice(1)}`;
    };

    return (
        <View style={[styles.container, { transform: [{ scale }] }]}>
            <LinearGradient
                colors={gradientColors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
            >
                {/* Background Pattern/Texture (Circles) */}
                <View style={[styles.circle, styles.circle1]} />
                <View style={[styles.circle, styles.circle2]} />

                {/* Card Header: Issuer & Chip */}
                <View style={styles.header}>
                    <View style={styles.chip} />
                    <Text style={styles.issuer}>{issuer.toUpperCase()}</Text>
                </View>

                {/* Card Number (Masked) */}
                <View style={styles.numberContainer}>
                    <Text style={styles.digits}>••••</Text>
                    <Text style={styles.digits}>••••</Text>
                    <Text style={styles.digits}>••••</Text>
                    <Text style={styles.digits}>{lastDigits}</Text>
                </View>

                {/* Card Footer: Name & Reward Badge */}
                <View style={styles.footer}>
                    <View>
                        <Text style={styles.label}>CARDHOLDER</Text>
                        <Text style={styles.name} numberOfLines={1}>{name.toUpperCase()}</Text>
                    </View>

                    {/* Top Reward Badge */}
                    <View style={styles.rewardBadge}>
                        <Ionicons name="star" size={10} color="black" />
                        <Text style={styles.rewardText}>{getPrimaryReward()}</Text>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
}

const CARD_WIDTH = Dimensions.get('window').width - 48; // Full width minus padding
const CARD_HEIGHT = CARD_WIDTH * 0.63; // Standard Credit Card Aspect Ratio

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: CARD_HEIGHT,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 20,
    },
    cardGradient: {
        flex: 1,
        borderRadius: 16,
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        justifyContent: 'space-between',
    },
    circle: {
        position: 'absolute',
        borderRadius: 200,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    circle1: {
        width: 300,
        height: 300,
        top: -100,
        right: -100,
    },
    circle2: {
        width: 200,
        height: 200,
        bottom: -50,
        left: -50,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    chip: {
        width: 40,
        height: 30,
        backgroundColor: '#e0cfa0', // Gold-ish
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bca36b',
    },
    issuer: {
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 1,
    },
    numberContainer: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'center',
        paddingLeft: 4,
    },
    digits: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 2,
        fontFamily: 'Courier', // Monospace feel
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    label: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 9,
        fontWeight: '700',
        marginBottom: 4,
    },
    name: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 1,
        maxWidth: 180,
    },
    rewardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fbbf24', // Gold badge
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    rewardText: {
        fontSize: 12,
        fontWeight: '800',
        color: 'black',
    },
    networkLogo: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 36,
        height: 24,
    },
    networkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        position: 'absolute',
        top: 0,
    },
});
