# Firebase Setup for Google OAuth

## Step 1: Get Your Firebase Web App Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **crowdalpha-30c2b**
3. Click the gear icon ⚙️ next to "Project Overview" → **Project Settings**
4. Scroll down to **"Your apps"** section
5. If you don't have a web app yet:
   - Click the **</>** (Web) icon
   - Register your app with a nickname (e.g., "CrowdAlpha Web")
   - Click "Register app"
6. Copy the Firebase configuration values (they look like this):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "crowdalpha-30c2b.firebaseapp.com",
  projectId: "crowdalpha-30c2b",
  storageBucket: "crowdalpha-30c2b.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 2: Create Frontend Environment File

Create a file `frontend/.env.local` with these values:

```bash
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=crowdalpha-30c2b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=crowdalpha-30c2b
VITE_FIREBASE_STORAGE_BUCKET=crowdalpha-30c2b.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Step 3: Verify Google Sign-In is Enabled

✅ **Already Done!** - I can see Google is enabled in your Firebase Console.

## Step 4: Test It

1. Restart your frontend dev server (to load new env variables)
2. Go to your landing page
3. Click the "Google" button
4. It should open a Google sign-in popup!

## Troubleshooting

If you see "Firebase API key not provided":
- Make sure `frontend/.env.local` exists
- Make sure the variable names start with `VITE_`
- Restart your dev server after creating/editing `.env.local`

If Google sign-in doesn't work:
- Check browser console for errors
- Make sure `localhost` is in Firebase Authorized Domains (Settings → Authorized domains)


