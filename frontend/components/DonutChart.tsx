import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Easing } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DonutChartProps {
    data: { category: string; count: number }[];
    size?: number;
    thickness?: number;
}

// Fixed color palette for categories
// Exported so TrendsScreen can use it too
export const CATEGORY_COLORS: { [key: string]: string } = {
    'dining': '#ef4444', // Red
    'groceries': '#14eda5ff', // Green
    'travel': '#2476faff', // Blue
    'gas': '#f59e0b', // Amber
    'shopping': '#8b5cf6', // Violet
    'entertainment': '#09d3f6ff', // Cyan
    'general': '#6b7280', // Gray
    'default': '#6b7280'
};

export const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS['default'];
};

export default function DonutChart({ data, size = 220, thickness = 24 }: DonutChartProps) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

    if (data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.count, 0);

    // Prevent NaN errors if total is 0
    if (total === 0) return null;

    const animValue = useRef(new Animated.Value(0)).current;
    const scaleValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Run animations in parallel for a rich "web-like" entrance
        Animated.parallel([
            // 1. Fill Animation (Smooth)
            Animated.timing(animValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            // 2. Scale Spring (Pop effect)
            Animated.spring(scaleValue, {
                toValue: 1,
                friction: 7,
                tension: 40,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const radius = size / 2;
    const circleRadius = radius - thickness / 2;
    const circumference = 2 * Math.PI * circleRadius;

    let currentAngle = -90; // Start at top

    return (
        <Animated.View style={[styles.container, {
            width: size,
            height: size,
            opacity: animValue, // Fade in
            transform: [{ scale: scaleValue }] // Zoom/Pop in
        }]}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <G rotation="0" origin={`${radius}, ${radius}`}>
                    {/* Background Ring */}
                    <Circle
                        cx={radius}
                        cy={radius}
                        r={circleRadius}
                        stroke={colors.surfaceHighlight}
                        strokeWidth={thickness}
                        fill="transparent"
                    />

                    {/* Colored Segments */}
                    {data.map((item, index) => {
                        const percentage = item.count / total;
                        const strokeDashoffset = circumference - (circumference * percentage);
                        const angle = (item.count / total) * 360;
                        const color = getCategoryColor(item.category);

                        // We render the circle start at currentAngle.
                        // However, SVG strokeDasharray always starts from 0 (3 o'clock) or -90 (12 o'clock).
                        // To stack segments, we must rotate the individual circle element.

                        const rotation = currentAngle;
                        currentAngle += angle;

                        return (
                            <AnimatedCircle
                                key={index}
                                cx={radius}
                                cy={radius}
                                r={circleRadius}
                                stroke={color}
                                strokeWidth={thickness}
                                fill="transparent"
                                strokeDasharray={`${circumference} ${circumference}`}
                                strokeDashoffset={strokeDashoffset} // Static value (no "filling" animation to prevent gaps)
                                strokeLinecap="butt"
                                rotation={rotation}
                                origin={`${radius}, ${radius}`}
                            />
                        );
                    })}
                </G>
            </Svg>

            {/* Center Text */}
            <View style={styles.centerContent}>
                <Text style={styles.totalCount}>{total}</Text>
                <Text style={styles.totalLabel}>Visits</Text>
            </View>
        </Animated.View>
    );
}

const makeStyles = (colors: any) => StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        alignSelf: 'center',
        position: 'relative',
    },
    centerContent: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalCount: {
        fontSize: 36,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    totalLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});
