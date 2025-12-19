import { Stack } from 'expo-router';
import { useEffect } from 'react';
import '../lib/location-task'; // Register background tasks

export default function Layout() {
    return (
        <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
            <Stack.Screen name="index" options={{ gestureEnabled: false }} />
            <Stack.Screen name="home" options={{ gestureEnabled: false }} />
            <Stack.Screen name="login" options={{ gestureEnabled: false }} />
            <Stack.Screen name="signup" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="change-password" />
            <Stack.Screen name="card-selection" options={{ presentation: 'modal' }} />
            <Stack.Screen name="questionnaire" options={{ gestureEnabled: false }} />
            <Stack.Screen name="permissions" options={{ gestureEnabled: false }} />
        </Stack>
    );
}
