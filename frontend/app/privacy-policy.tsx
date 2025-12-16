import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/Colors';

export default function PrivacyPolicyScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.lastUpdated}>Last Updated: December 2025</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Introduction</Text>
                    <Text style={styles.paragraph}>
                        TapRight ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Information We Collect</Text>
                    <Text style={styles.paragraph}>
                        We collect information to provide better services to all our users. This includes:
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Location Data: We collect precise location data to identify nearby merchants and suggest relevant credit cards.</Text>
                        <Text style={styles.bulletItem}>• Wallet Information: We store the list of credit cards you add to the app to provide personalized recommendations.</Text>
                        <Text style={styles.bulletItem}>• User Profile: Name, email address, and account preferences.</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
                    <Text style={styles.paragraph}>
                        We use the collected data for the following purposes:
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• To provide real-time card recommendations based on your location.</Text>
                        <Text style={styles.bulletItem}>• To analyze spending trends and offer insights.</Text>
                        <Text style={styles.bulletItem}>• To improve our app functionality and user experience.</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Data Security</Text>
                    <Text style={styles.paragraph}>
                        We implement security measures designed to protect your information from unauthorized access. Your data is stored securely using industry-standard encryption.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Contact Us</Text>
                    <Text style={styles.paragraph}>
                        If you have any questions about this Privacy Policy, please contact us at info@tapright.app.
                    </Text>
                </View>

                <View style={styles.footerSpace} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surfaceHighlight,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    content: {
        padding: 24,
    },
    lastUpdated: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 12,
    },
    paragraph: {
        fontSize: 16,
        lineHeight: 24,
        color: COLORS.textSecondary,
    },
    bulletList: {
        marginTop: 8,
        gap: 8,
    },
    bulletItem: {
        fontSize: 16,
        lineHeight: 24,
        color: COLORS.textSecondary,
        paddingLeft: 8,
    },
    footerSpace: {
        height: 40,
    },
});
