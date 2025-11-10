#!/bin/bash
echo "Starting TapWise App..."
echo ""
echo "Backend: http://localhost:8000"
echo ""

# Start backend in background
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
echo "Starting backend server..."
uvicorn server:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
echo ""

# Start frontend
cd ../frontend
echo "Starting Expo development server..."
echo "QR code will appear below:"
echo ""
yarn start
