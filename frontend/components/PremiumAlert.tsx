import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface PremiumAlertProps {
    visible: boolean;
    title: string;
    message: string;
    icon?: keyof typeof Ionicons.glyphMap;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function PremiumAlert({
    visible,
    title,
    message,
    icon = 'notifications',
    confirmText = 'Allow',
    cancelText = 'Not Now',
    onConfirm,
    onCancel,
}: PremiumAlertProps) {
    const { colors, isDark } = useTheme();
    const styles = makeStyles(colors);

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={isDark ? "dark" : "light"} />
                <View style={styles.alertContainer}>
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={[colors.accent, '#2980b9']}
                            style={styles.iconGradient}
                        >
                            <Ionicons name={icon} size={32} color="white" />
                        </LinearGradient>
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={[styles.buttonContainer, !cancelText && styles.buttonContainerSingle]}>
                        {cancelText ? (
                            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
                                <Text style={styles.cancelText}>{cancelText}</Text>
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity onPress={onConfirm} style={[styles.confirmButtonWrapper, !cancelText && styles.confirmButtonWrapperFull]}>
                            <LinearGradient
                                colors={[colors.accent, '#2980b9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.confirmButton}
                            >
                                <Text style={styles.confirmText}>{confirmText}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', // Slightly darker overlay for better contrast
    },
    alertContainer: {
        width: width * 0.85,
        backgroundColor: colors.surface, // Dynamic background
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2, // Softer shadow for light theme
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 16,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    iconGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.textPrimary, // Dynamic text
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: colors.textSecondary, // Dynamic text
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        gap: 12,
    },
    buttonContainerSingle: {
        justifyContent: 'center',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: colors.surfaceSoft, // Dynamic background
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        color: colors.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButtonWrapper: {
        flex: 1,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    confirmButtonWrapperFull: {
        width: '100%',
    },
    confirmButton: {
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
