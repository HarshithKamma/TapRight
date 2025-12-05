import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    StatusBar,
    Animated,
    Easing,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';

// Custom Animated Switch Component (Same as Home Screen)
const CustomSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: (val: boolean) => void }) => {
    const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(animValue, {
            toValue: value ? 1 : 0,
            duration: 300,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: false,
        }).start();
    }, [value]);

    const translateX = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [2, 22],
    });

    const backgroundColor = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.surfaceHighlight, COLORS.success],
    });

    return (
        <Pressable onPress={() => onValueChange(!value)}>
            <Animated.View style={[styles.switchTrack, { backgroundColor }]}>
                <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]} />
            </Animated.View>
        </Pressable>
    );
};

const SettingItem = ({ icon, title, value, onValueChange, type = 'toggle' }: any) => (
    <View style={styles.settingItem}>
        <View style={styles.settingLeft}>
            <View style={styles.iconContainer}>
                <Ionicons name={icon} size={20} color={COLORS.textPrimary} />
            </View>
            <Text style={styles.settingTitle}>{title}</Text>
        </View>
        {type === 'toggle' ? (
            <CustomSwitch
                value={value}
                onValueChange={onValueChange}
            />
        ) : (
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        )}
    </View>
);

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser({
                    name: user.user_metadata?.full_name || 'User',
                    email: user.email,
                    initials: (user.user_metadata?.full_name || 'U').charAt(0).toUpperCase(),
                });
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.clear();
                        await supabase.auth.signOut();
                        router.replace('/');
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* User Info Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user?.initials}</Text>
                    </View>
                    <Text style={styles.userName}>{user?.name}</Text>
                    <Text style={styles.userEmail}>{user?.email}</Text>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => router.push('/edit-profile')}
                    >
                        <Text style={styles.editButtonText}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Preferences Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.sectionContent}>
                        <SettingItem
                            icon="notifications-outline"
                            title="Push Notifications"
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                        />
                        <View style={styles.separator} />
                        <SettingItem
                            icon="location-outline"
                            title="Location Services"
                            value={locationEnabled}
                            onValueChange={setLocationEnabled}
                        />
                    </View>
                </View>

                {/* Support Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <View style={styles.sectionContent}>
                        <TouchableOpacity style={styles.menuItem}>
                            <SettingItem icon="help-circle-outline" title="Help Center" type="link" />
                        </TouchableOpacity>
                        <View style={styles.separator} />
                        <TouchableOpacity style={styles.menuItem}>
                            <SettingItem icon="shield-checkmark-outline" title="Privacy Policy" type="link" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>Version 1.0.0</Text>
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
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    content: {
        padding: 24,
        gap: 32,
    },
    profileCard: {
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 32,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 4,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    userName: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 16,
        color: COLORS.textSecondary,
        marginBottom: 20,
    },
    editButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 100,
        backgroundColor: COLORS.textPrimary,
    },
    editButtonText: {
        color: COLORS.surface,
        fontWeight: '600',
        fontSize: 14,
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 8,
    },
    sectionContent: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    separator: {
        height: 1,
        backgroundColor: COLORS.surfaceHighlight,
        marginLeft: 64,
    },
    menuItem: {
        activeOpacity: 0.7,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fee2e2', // Light red
        padding: 16,
        borderRadius: 24,
        gap: 8,
        marginTop: 8,
    },
    logoutText: {
        color: COLORS.error,
        fontSize: 16,
        fontWeight: '700',
    },
    versionText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 8,
    },
    switchTrack: {
        width: 50,
        height: 28,
        borderRadius: 14,
        padding: 2,
        justifyContent: 'center',
    },
    switchThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2.5,
        elevation: 2,
    },
});
