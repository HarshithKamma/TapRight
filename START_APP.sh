#!/bin/bash
echo "Starting TapRight App..."
echo "--------------------------------"

# Start Frontend
cd frontend
echo "Starting Expo development server (Dev Client)..."
npx expo start --dev-client
