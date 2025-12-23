import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Animated,
    Easing,
    Pressable,
    Linking,
    Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import PremiumAlert from '../components/PremiumAlert';

// Custom Animated Switch Component
const CustomSwitch = ({ value, onValueChange, colors }: { value: boolean, onValueChange: (val: boolean) => void, colors: any }) => {
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
        outputRange: [colors.surfaceHighlight, colors.success],
    });

    return (
        <Pressable onPress={() => {
            Haptics.selectionAsync();
            onValueChange(!value);
        }}>
            <Animated.View style={[
                {
                    width: 50,
                    height: 28,
                    borderRadius: 14,
                    padding: 2,
                    justifyContent: 'center',
                },
                { backgroundColor }
            ]}>
                <Animated.View style={[
                    {
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
                    { transform: [{ translateX }] }
                ]} />
            </Animated.View>
        </Pressable>
    );
};

const SettingItem = ({ icon, title, value, onValueChange, type = 'toggle', onPress, displayValue, colors, styles }: any) => (
    <View style={styles.settingItem}>
        <View style={styles.settingLeft}>
            <View style={styles.iconContainer}>
                <Ionicons name={icon} size={20} color={colors.textPrimary} />
            </View>
            <Text style={styles.settingTitle}>{title}</Text>
        </View>
        {type === 'toggle' ? (
            <CustomSwitch
                value={value}
                onValueChange={onValueChange}
                colors={colors}
            />
        ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {displayValue && <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{displayValue}</Text>}
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
        )}
    </View>
);

export default function ProfileScreen() {
    const router = useRouter();
    const { theme, setTheme, colors, isDark } = useTheme();
    const styles = makeStyles(colors, isDark);

    const [user, setUser] = useState<any>(null);
    const [cardNames, setCardNames] = useState<string[]>([]);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [themeModalVisible, setThemeModalVisible] = useState(false);

    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        icon: 'notifications' as any,
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
    });

    const showAlert = (title: string, message: string, icon = 'alert-circle') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            icon: icon as any,
            confirmText: 'OK',
            cancelText: '',
            onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false })),
        });
    };

    const handleLogout = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAlertConfig({
            visible: true,
            title: 'Log Out',
            message: 'Are you sure you want to log out of your account?',
            icon: 'log-out-outline',
            confirmText: 'Log Out',
            cancelText: 'Cancel',
            onConfirm: handleConfirmAction,
        });
    };

    const handleConfirmAction = async () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        await AsyncStorage.clear();
        await supabase.auth.signOut();
        router.replace('/');
    };

    useEffect(() => {
        loadUserProfile();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadUserProfile();
            loadPermissionStatus();
        }, [])
    );

    // Load actual permission status from system
    const loadPermissionStatus = async () => {
        try {
            const notifStatus = await Notifications.getPermissionsAsync();
            setNotificationsEnabled(notifStatus.status === 'granted');

            const locStatus = await Location.getForegroundPermissionsAsync();
            setLocationEnabled(locStatus.status === 'granted');
        } catch (error) {
            console.warn('Failed to load permission status:', error);
        }
    };

    // Handle notification toggle
    const handleNotificationToggle = async (enabled: boolean) => {
        if (enabled) {
            const { status } = await Notifications.requestPermissionsAsync();
            setNotificationsEnabled(status === 'granted');
            if (status !== 'granted') {
                showAlert('Permission Denied', 'Please enable notifications in your device settings.', 'notifications');
            }
        } else {
            // Can't programmatically disable - just update UI and inform user
            showAlert('Disable Notifications', 'To disable notifications, please go to your device Settings > TapRight > Notifications.', 'settings-outline');
        }
    };

    // Handle location toggle
    const handleLocationToggle = async (enabled: boolean) => {
        if (enabled) {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationEnabled(status === 'granted');
            if (status !== 'granted') {
                showAlert('Permission Denied', 'Please enable location in your device settings.', 'location');
            }
        } else {
            // Can't programmatically disable - just update UI and inform user
            showAlert('Disable Location', 'To disable location services, please go to your device Settings > TapRight > Location.', 'settings-outline');
        }
    };

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const fullName = user.user_metadata?.full_name || 'User';
                const names = fullName.trim().split(' ');
                let initials = '';
                if (names.length >= 2) {
                    initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
                } else if (names.length === 1) {
                    initials = names[0].slice(0, 2).toUpperCase();
                }

                setUser({
                    name: fullName,
                    email: user.email,
                    initials: initials
                });

                const { data: userCards, error } = await supabase
                    .from('user_cards')
                    .select('credit_cards (name)')
                    .eq('user_id', user.id);

                if (userCards) {
                    const names = userCards.map((item: any) => item.credit_cards?.name).filter(Boolean);
                    setCardNames(names);
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const handleHelpCenter = async () => {
        const url = 'mailto:info@tapright.app';
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                showAlert('Error', 'No email client available.');
            }
        } catch (err) {
            showAlert('Error', 'Could not open email client.');
        }
    };

    const handlePrivacyPolicy = () => {
        router.push('/privacy-policy');
    };

    const ThemeOption = ({ label, value, icon }: any) => (
        <TouchableOpacity
            style={[styles.themeOption, theme === value && styles.themeOptionActive]}
            onPress={() => {
                setTheme(value);
                setThemeModalVisible(false);
                Haptics.selectionAsync();
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.themeIcon, theme === value && { backgroundColor: colors.background }]}>
                    <Ionicons name={icon} size={20} color={theme === value ? colors.textPrimary : colors.textSecondary} />
                </View>
                <Text style={[styles.themeText, theme === value && { color: colors.surface, fontWeight: '700' }]}>
                    {label}
                </Text>
            </View>
            {theme === value && <Ionicons name="checkmark-circle" size={24} color={colors.surface} />}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <PremiumAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                icon={alertConfig.icon}
                confirmText={alertConfig.confirmText}
                cancelText={alertConfig.cancelText}
                onConfirm={alertConfig.onConfirm}
                onCancel={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />

            {/* Theme Selection Modal */}
            <Modal
                visible={themeModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setThemeModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setThemeModalVisible(false)}>
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <Text style={styles.modalTitle}>Appearance</Text>
                        <View style={{ gap: 8, width: '100%' }}>
                            <ThemeOption label="Light" value="light" icon="sunny-outline" />
                            <ThemeOption label="Dark" value="dark" icon="moon-outline" />
                            <ThemeOption label="System" value="system" icon="phone-portrait-outline" />
                        </View>
                        <TouchableOpacity style={{ marginTop: 20, alignSelf: 'center' }} onPress={() => setThemeModalVisible(false)}>
                            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>


            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
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
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/edit-profile');
                        }}
                    >
                        <Text style={styles.editButtonText}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Wallet Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>My Wallet ({cardNames.length})</Text>
                    <View style={styles.sectionContent}>
                        {cardNames.length > 0 ? (
                            cardNames.map((name, index) => (
                                <React.Fragment key={index}>
                                    <View style={styles.settingItem}>
                                        <View style={styles.settingLeft}>
                                            <View style={[styles.iconContainer, { backgroundColor: colors.surfaceHighlight }]}>
                                                <Ionicons name="card" size={16} color={colors.textSecondary} />
                                            </View>
                                            <Text style={styles.settingTitle}>{name}</Text>
                                        </View>
                                    </View>
                                    {index < cardNames.length - 1 && <View style={styles.separator} />}
                                </React.Fragment>
                            ))
                        ) : (
                            <View style={styles.settingItem}>
                                <Text style={[styles.settingTitle, { color: colors.textSecondary }]}>No cards added</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Preferences Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.sectionContent}>
                        <SettingItem
                            icon="notifications-outline"
                            title="Push Notifications"
                            value={notificationsEnabled}
                            onValueChange={handleNotificationToggle}
                            colors={colors}
                            styles={styles}
                        />
                        <View style={styles.separator} />
                        <SettingItem
                            icon="location-outline"
                            title="Location Services"
                            value={locationEnabled}
                            onValueChange={handleLocationToggle}
                            colors={colors}
                            styles={styles}
                        />
                        <View style={styles.separator} />
                        {/* Appearance Setting */}
                        <TouchableOpacity style={styles.menuItem} onPress={() => setThemeModalVisible(true)}>
                            <SettingItem
                                icon="color-palette-outline"
                                title="Appearance"
                                type="link"
                                displayValue={theme.charAt(0).toUpperCase() + theme.slice(1)}
                                colors={colors}
                                styles={styles}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Security Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Security</Text>
                    <View style={styles.sectionContent}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/change-password' as any)}>
                            <SettingItem
                                icon="lock-closed-outline"
                                title="Change Password"
                                type="link"
                                colors={colors}
                                styles={styles}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Support Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <View style={styles.sectionContent}>
                        <TouchableOpacity style={styles.menuItem} onPress={handleHelpCenter}>
                            <SettingItem icon="help-circle-outline" title="Help Center" type="link" colors={colors} styles={styles} />
                        </TouchableOpacity>
                        <View style={styles.separator} />
                        <TouchableOpacity style={styles.menuItem} onPress={handlePrivacyPolicy}>
                            <SettingItem icon="shield-checkmark-outline" title="Privacy Policy" type="link" colors={colors} styles={styles} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>Version 1.0.0</Text>
            </ScrollView>
        </View>
    );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        backgroundColor: colors.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    content: {
        padding: 24,
        gap: 32,
    },
    profileCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 32,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        shadowColor: colors.shadow,
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 4,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    userName: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 20,
    },
    editButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 100,
        backgroundColor: colors.textPrimary,
    },
    editButtonText: {
        color: colors.surface,
        fontWeight: '600',
        fontSize: 14,
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 8,
    },
    sectionContent: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
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
        backgroundColor: colors.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    separator: {
        height: 1,
        backgroundColor: colors.surfaceHighlight,
        marginLeft: 64,
    },
    menuItem: {
        // activeOpacity is a prop, not a style
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', // Dynamic red bg
        padding: 16,
        borderRadius: 24,
        gap: 8,
        marginTop: 8,
    },
    logoutText: {
        color: colors.error,
        fontSize: 16,
        fontWeight: '700',
    },
    versionText: {
        textAlign: 'center',
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 32,
        padding: 32,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: colors.shadow,
        shadowOpacity: 0.25,
        shadowRadius: 30,
        elevation: 10,
        shadowOffset: { width: 0, height: 10 },
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 24,
        textAlign: 'center',
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 20,
        backgroundColor: colors.surfaceSoft,
        width: '100%',
    },
    themeOptionActive: {
        backgroundColor: colors.textPrimary,
    },
    themeIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    themeText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    }
});
