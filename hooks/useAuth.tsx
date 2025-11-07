import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check authentication status on app start
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      if (Platform.OS === 'web') {
        // On web, use localStorage as fallback or skip
        setIsLoading(false);
        return;
      }
      
      const userData = await AsyncStorage.getItem('user');
      const sessionToken = await AsyncStorage.getItem('sessionToken');

      if (userData && sessionToken) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      }
    } catch (error) {
      // Silently fail - AsyncStorage may not be available
    } finally {
      setIsLoading(false);
    }
  };

  // Simple password hashing for demo purposes
  const hashPassword = async (password: string): Promise<string> => {
    // In a real app, use a proper hashing library like bcrypt
    // For demo purposes, we'll use a simple hash
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + 'tapright-salt');
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hashArray = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        // Fallback for environments without crypto.subtle
        // Simple hash - not secure, but works for demo
        let hash = 0;
        const str = password + 'tapright-salt';
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
      }
    } catch (error) {
      // Fallback hash - simple string hash
      let hash = 0;
      const str = password + 'tapright-salt';
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16).padStart(16, '0');
    }
  };

  // Verify password
  const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    const hashed = await hashPassword(password);
    return hashed === hashedPassword;
  };

  // Login function
  const login = async (email: string, password: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // Web login can use localStorage or skip for demo
      return false;
    }
    
    try {
      // Get stored user data
      const userData = await AsyncStorage.getItem(`user_${email}`);
      if (!userData) {
        return false;
      }

      const parsedUser = JSON.parse(userData);
      const isPasswordValid = await verifyPassword(password, parsedUser.passwordHash);

      if (isPasswordValid) {
        const userSession = {
          id: parsedUser.id,
          name: parsedUser.name,
          email: parsedUser.email,
          phone: parsedUser.phone,
        };

        // Create session token
        const sessionToken = generateSessionToken();

        // Store session
        await AsyncStorage.setItem('user', JSON.stringify(userSession));
        await AsyncStorage.setItem('sessionToken', sessionToken);
        await AsyncStorage.setItem('lastLogin', new Date().toISOString());

        setUser(userSession);
        return true;
      }

      return false;
    } catch (error) {
      // Silently fail
      return false;
    }
  };

  // Signup function
  const signup = async (name: string, email: string, phone: string, password: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // Web signup can use localStorage or skip for demo
      return false;
    }
    
    try {
      // Check if user already exists
      const existingUser = await AsyncStorage.getItem(`user_${email}`);
      if (existingUser) {
        return false;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return false;
      }

      // Validate password (minimum 6 characters)
      if (password.length < 6) {
        return false;
      }

      // Create new user
      const userId = generateUserId();
      const passwordHash = await hashPassword(password);

      const newUser = {
        id: userId,
        name,
        email,
        phone,
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      // Store user data
      await AsyncStorage.setItem(`user_${email}`, JSON.stringify(newUser));

      // Create session
      const userSession = {
        id: userId,
        name,
        email,
        phone,
      };

      const sessionToken = generateSessionToken();

      await AsyncStorage.setItem('user', JSON.stringify(userSession));
      await AsyncStorage.setItem('sessionToken', sessionToken);
      await AsyncStorage.setItem('lastLogin', new Date().toISOString());

      setUser(userSession);
      return true;
    } catch (error) {
      // Silently fail
      return false;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      if (Platform.OS !== 'web') {
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('sessionToken');
        await AsyncStorage.removeItem('lastLogin');
      }
      setUser(null);
      router.replace('/login');
    } catch (error) {
      // Silently fail
    }
  };

  // Generate simple session token
  const generateSessionToken = (): string => {
    return Math.random().toString(36).substr(2) + Date.now().toString(36);
  };

  // Generate simple user ID
  const generateUserId = (): string => {
    return 'user_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    signup,
    logout,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}