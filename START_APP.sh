#!/bin/bash
echo "Starting TapRight App..."
echo "--------------------------------"

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "Stopping Backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID
    exit
}

# Trap Ctrl+C (SIGINT) and call cleanup
trap cleanup SIGINT

# Start Backend
echo "Starting Backend server..."
cd backend
# Check if venv exists, if so activate it
if [ -d "venv" ]; then
    source venv/bin/activate
fi
python3 server.py > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID). Logs redirected to backend.log"
cd ..

echo "--------------------------------"

# Start Frontend
cd frontend
echo "Starting Expo development server (Dev Client)..."
npx expo start --dev-client
