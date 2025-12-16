#!/bin/bash
echo "Starting TapRight App..."
echo "--------------------------------"
echo "Connecting to Supabase..."
echp "Unloading environment variables..."

# Start Frontend
cd frontend
echo "Starting Expo development server (Dev Client)..."
npx expo start --dev-client
