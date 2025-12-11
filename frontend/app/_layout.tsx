import { Stack } from 'expo-router';
import { useEffect } from 'react';
import '../lib/location-task'; // Register background tasks

export default function Layout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="home" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="card-selection" />
            <Stack.Screen name="questionnaire" />
            <Stack.Screen name="permissions" />
        </Stack>
    );
}
