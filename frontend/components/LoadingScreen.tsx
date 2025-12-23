import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
    const { colors, isDark } = useTheme();
    const styles = makeStyles(colors);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
                <Image
                    source={require('../assets/images/tapright-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </Animated.View>
            <Text style={styles.message}>{message}</Text>
        </View>
    );
}

const makeStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 50,
        shadowColor: colors.accent,
        shadowOpacity: 0.5,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 0 },
        elevation: 10,
        marginBottom: 24,
    },
    logo: {
        width: 60,
        height: 60,
    },
    message: {
        fontSize: 18,
        color: colors.textSecondary,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
