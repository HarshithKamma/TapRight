# Testing Notifications in TapRight

## Quick Test Guide

### In Expo Go (Current Setup)

1. **Open the app** in Expo Go on your iPhone
2. **Navigate to Notification Demo**:
   - After login/signup, you should be directed to location permission
   - After granting location, you'll see the notification demo screen
   - OR navigate to `/notification-demo` route

3. **Enable Notifications**:
   - Tap "Enable Notifications" button
   - Grant permission when iOS prompts you
   - Make sure notifications are enabled in iOS Settings > Expo Go > Notifications

4. **Test Notifications**:
   - Tap "🧪 Send Test Notification" - should send immediately
   - Tap "🏪 Test Location Suggestion" - should send a card recommendation
   - Check your notification center (swipe down from top)

### What Works in Expo Go:
✅ Local notifications (sent immediately)
✅ Scheduled notifications (future notifications)
✅ Notification permissions
✅ Notification preferences

### What Doesn't Work in Expo Go:
❌ Push notifications (remote notifications)
❌ Background notifications (when app is closed)
❌ Some advanced notification features

### For Full Notification Testing:

If you need to test push notifications or background notifications, you'll need to create a **development build**:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Create a development build
eas build --profile development --platform ios
```

## Troubleshooting

### Notifications Not Showing?
1. Check iOS Settings > Expo Go > Notifications - make sure it's enabled
2. Check if Do Not Disturb is on
3. Check quiet hours settings in the app
4. Look at the Expo terminal for error messages

### Permission Denied?
1. Go to iOS Settings > Expo Go > Notifications
2. Enable "Allow Notifications"
3. Restart the app and try again

### Still Not Working?
- Check the console/logs in Expo terminal
- Try restarting the Expo server
- Make sure you're on iOS (Android has different limitations)

