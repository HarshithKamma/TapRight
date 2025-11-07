#!/bin/bash
# Quick push script for TapRight

echo "🚀 Pushing to GitHub..."

# Update remote (replace YOUR_USERNAME with your actual GitHub username if needed)
git remote set-url origin https://github.com/KhushManchanda/TapRight.git

# Push to main branch
git push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to GitHub!"
    echo "👉 View your repo at: https://github.com/KhushManchanda/TapRight"
else
    echo "❌ Push failed. Make sure:"
    echo "   1. Repository exists at: https://github.com/KhushManchanda/TapRight"
    echo "   2. You're authenticated with GitHub"
    echo "   3. Repository is empty or you have push access"
fi
