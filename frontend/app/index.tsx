import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Dimensions, StatusBar, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';

const { width, height } = Dimensions.get('window');

// Money items to rain down (Green bills only)
const MONEY_ITEMS = ['💵', '💸']; // Removed 💲 as it can render grey
const NUM_DROPS = 25;

const MoneyDrop = ({ delay, startX, duration, size, opacity }: { delay: number, startX: number, duration: number, size: number, opacity: number }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      translateY.setValue(-100);
      rotate.setValue(0);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height + 100,
          duration: duration,
          delay: delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: duration,
          delay: delay,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ]).start(() => animate());
    };

    animate();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const randomItem = MONEY_ITEMS[Math.floor(Math.random() * MONEY_ITEMS.length)];

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: startX,
        top: -50, // Start slightly off screen
        fontSize: size,
        transform: [{ translateY }, { rotate: spin }],
        zIndex: 0,
        opacity: opacity,
        color: '#22c55e', // Force green color for any text symbols
      }}
    >
      {randomItem}
    </Animated.Text>
  );
};

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Generate random drops with more variation
  const drops = useRef(Array.from({ length: NUM_DROPS }).map((_, i) => ({
    id: i,
    startX: Math.random() * width,
    delay: Math.random() * 8000, // Spread out start times more
    duration: 5000 + Math.random() * 4000, // Slower fall for elegance
    size: 24 + Math.random() * 24,
    opacity: 0.3 + Math.random() * 0.4,
  }))).current;

  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.log('Session error:', error.message);
        supabase.auth.signOut();
        setCheckingSession(false);
        return;
      }

      if (data?.session) {
        // User is logged in, redirect to home
        router.replace('/home');
      } else {
        // No session, show the buttons
        setCheckingSession(false);
      }
    }).catch(() => setCheckingSession(false));

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 20,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const logoSource = require('../assets/images/tapright-logo.png');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Money Rain Animation */}
      {drops.map((drop) => (
        <MoneyDrop key={drop.id} {...drop} />
      ))}

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.centerContent}>
          <View style={styles.logoContainer}>
            <View style={styles.glowEffect} />
            <Image
              source={logoSource}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>TapRight</Text>
            <Text style={styles.tagline}>Maximize every swipe.</Text>
          </View>
        </View>

        {/* Only show buttons if we are done checking session and the user is NOT logged in */}
        {!checkingSession && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/signup')}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>I have an account</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 60,
    zIndex: 1, // Ensure content is above rain
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
  },
  glowEffect: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(28, 25, 23, 0.05)', // Subtle dark glow
    transform: [{ scale: 1.2 }],
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  textContainer: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.textPrimary, // Uses dark stone color
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: COLORS.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  footer: {
    width: '100%',
    gap: 20,
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent, // Dark Stone
    paddingVertical: 20,
    borderRadius: 100,
    gap: 12,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.5, // Stronger shadow for "glowing" effect
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
