# TapRight Automatic Background Notifications Guide

## How It Works

TapRight automatically monitors your location in the background and sends you notifications when you're near stores that offer rewards with your credit cards.

### Example Notification
```
"Hey, you're at Target! Use Discover it Cash Back to get 5% back."
```

## Setup Requirements

### 1. Enable Location Tracking
- Open TapRight app
- Go to Home screen
- Toggle "Tracking: ON" button at the top
- Keep the app running in background

### 2. Grant Permissions
- **Location**: "Always Allow" (required for background tracking)
- **Notifications**: Allow notifications

### 3. Add Your Cards
- Tap "Manage Cards" button
- Select all credit cards you own
- Tap "Save Changes"

## How Background Tracking Works

### Tracking Frequency
- Location checked every **2 minutes** (120 seconds)
- Distance threshold: **100 meters** movement

### Detection Process
1. App monitors your location in the background
2. When you enter a geofence (150-250m radius) around a store
3. System identifies the merchant and category
4. Matches your cards with best rewards for that category
5. Sends immediate notification with recommendation

### Notification Throttling
- **4-hour cooldown** per merchant
- Prevents spam from repeated visits
- Reset after 4 hours at same location

## Supported Merchants & Categories

### Current POI Database

**Coffee Shops** (200m radius):
- Starbucks Downtown, Times Square, LA

**Gas Stations** (200m radius):
- Chevron, Shell, Exxon, BP

**Grocery Stores** (200m radius):
- Whole Foods, Trader Joe's, Safeway, Kroger

**Restaurants** (150m radius):
- Chipotle, McDonald's, Olive Garden, Panera Bread

**Retail Stores** (150-250m radius):
- Target (250m)
- Walmart (250m)
- Best Buy (200m)
- CVS Pharmacy (150m)
- Walgreens (150m)

## Card Rewards Mapping

**Discover it Cash Back**: 5% on rotating categories
**Chase Freedom Flex**: 3% dining, 3% gas
**Amex Blue Cash**: 3% gas, 2% grocery
**Capital One SavorOne**: 3% dining, 3% entertainment, 2% grocery
**Chase Sapphire Preferred**: 3x dining, 3x travel
**Amex Gold**: 4x dining, 4x grocery
**Citi Double Cash**: 2% everything

## Testing on Real Device

### For Full Functionality (iOS/Android with Expo Go):

1. **Download Expo Go** from App Store/Play Store
2. **Scan QR Code** from your Expo dashboard
3. **Grant Permissions**:
   - Location: "Always Allow"
   - Notifications: Allow
4. **Enable Tracking**: Toggle ON in home screen
5. **Keep App Running**: Don't force close
6. **Visit a Store**: Walk near any supported merchant

### Expected Behavior:
- Notification appears within 2 minutes of entering geofence
- Shows merchant name and best card recommendation
- No duplicate notifications for 4 hours

## Platform Limitations

### Web Browser:
- ❌ Background location tracking NOT supported
- ✅ Manual location check available ("Check Current Location" button)
- Browser security restricts background services

### Expo Go:
- ⚠️ Limited background tracking capabilities
- Works in foreground and recent background
- May stop if app is force-closed

### Development Build (Recommended for Production):
- ✅ Full background location tracking
- ✅ Persistent background services
- ✅ Works even when app is completely closed

## Troubleshooting

### No Notifications Received?

**Check Tracking Status:**
- Home screen shows "Tracking: ON"
- Green badge confirms active tracking

**Verify Permissions:**
- Settings > TapRight > Location: "Always"
- Settings > TapRight > Notifications: Enabled

**Check Card Wallet:**
- At least one card added
- Cards have rewards for visited category

**Distance Check:**
- Must be within 150-250m of merchant
- GPS accuracy affects detection

**Cooldown Period:**
- Wait 4 hours if already notified at same location

### Background Tracking Stopped?

**iOS:**
- Don't swipe app away from recent apps
- iOS may suspend after extended background time
- Reopen app to restart tracking

**Android:**
- Check battery optimization settings
- Disable "Battery Saver" for TapRight
- Allow "Run in background"

## API Endpoint for Manual Testing

```bash
# Test location check manually
curl -X POST http://your-backend/api/location/check \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.7549,
    "longitude": -122.4494,
    "user_id": "YOUR_USER_ID"
  }'

# Response for Target location (37.7549, -122.4494):
{
  "found": true,
  "recommendation": {
    "merchant_name": "Target",
    "category": "retail",
    "recommended_card": "Discover it Cash Back",
    "reward_rate": "5% back",
    "message": "Hey, you're at Target! Use Discover it Cash Back to get 5% back."
  }
}
```

## Location Coordinates for Testing

Use these coordinates to test manually:

- **Target**: 37.7549, -122.4494
- **Starbucks**: 37.7749, -122.4194
- **Chevron**: 37.7849, -122.4094
- **Whole Foods**: 37.7849, -122.4294

## Future Enhancements

- Real-time merchant database via Google Places API
- Expanded merchant coverage
- Custom notification sounds per card
- Weekly reward summary
- Spending analytics
