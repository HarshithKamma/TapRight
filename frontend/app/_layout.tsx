import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../lib/location-task'; // Register background tasks

export default function Layout() {
    const router = useRouter();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                // Determine if we need to redirect. 
                // Usually expo-router handles this if using protected routes, 
                // but since we are handling it manually:
                // We can't easily subscribe to path changes here without a hook, 
                // but we can ensure we aren't stuck.
                // For now, let's just log. The individual pages (home, profile) 
                // check for user existence usually.
                console.log('Auth State: Signed Out');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

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
