# Firebase Setup Guide for InvestSavvy

## Prerequisites
- Firebase CLI: `npm install -g firebase-tools`
- Google account for Firebase console access

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Enter project name: `camelApp` (or your preferred name)
4. Enable Google Analytics (optional but recommended)
5. Select Google Analytics account or create new one

## 2. Configure Authentication

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Google** provider:
   - Click on Google
   - Enable the provider
   - Add your project support email
   - Save
3. In **Settings** tab, add authorized domains:
   - `localhost` (for development)
   - Your production domain (e.g., `camelapp.vercel.app`)

## 3. Set up Firestore Database

1. Go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll update rules later)
4. Select database location (choose closest to your users)

### Deploy Security Rules
```bash
# From project root
firebase deploy --only firestore:rules
```

### Deploy Indexes
```bash
firebase deploy --only firestore:indexes
```

## 4. Get Firebase Configuration

1. Go to **Project Settings** > **General**
2. Scroll down to **Your apps**
3. Click **Web app** icon (</>) 
4. Enter app nickname: `CamelApp Web`
5. Don't check "Set up Firebase Hosting"
6. Copy the configuration object

## 5. Environment Variables Setup

Create `.env` file in project root:

```bash
# Copy from .env.template
cp .env.template .env
```

Fill in your Firebase configuration:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Market Data API (choose one)
VITE_ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
# OR
VITE_IEX_CLOUD_API_KEY=your_iex_cloud_key

# Environment
VITE_ENVIRONMENT=development
```

## 6. Initialize Firebase CLI

```bash
# Login to Firebase
firebase login

# Initialize project
firebase init

# Select:
# - Firestore
# - Functions (if setting up Cloud Functions)
# - Hosting (if using Firebase Hosting instead of Vercel)

# Choose existing project: your-project-id
```

## 7. Test Authentication

1. Start development server: `npm run dev`
2. Try signing in with Google OAuth
3. Check Firebase Console > Authentication > Users to see if user was created
4. Check Firestore Console to see if user profile was created in `users` collection

## 8. Cloud Functions Setup (Optional)

If you want to set up Cloud Functions for server-side logic:

```bash
# Initialize functions
firebase init functions

# Choose TypeScript or JavaScript
# Install dependencies
cd functions
npm install

# Deploy functions
firebase deploy --only functions
```

## 9. Security Rules Validation

Test your Firestore security rules:
```bash
# Install emulator
firebase init emulators

# Run emulators
firebase emulators:start

# Access Firestore emulator UI at http://localhost:4000
```

## 10. Production Deployment

For production deployment, update:
1. **Authentication domains**: Add your production domain
2. **Environment variables**: Use production API keys
3. **Security rules**: Review and tighten if needed
4. **CORS settings**: Configure for your domain

## Troubleshooting

### Common Issues:

**1. "Firebase: Error (auth/unauthorized-domain)"**
- Add your domain to authorized domains in Firebase Console

**2. "Firebase: Error (auth/popup-blocked)"**
- Enable popups in browser or use redirect method

**3. "Missing or insufficient permissions"**
- Check Firestore security rules
- Ensure user is authenticated

**4. Network errors**
- Check if Firebase SDK is properly initialized
- Verify API keys are correct

### Debug Mode:
Set `VITE_ENVIRONMENT=development` in `.env` for detailed error logging.

## Next Steps

After Firebase setup is complete:
1. Test all authentication flows
2. Verify Firestore read/write operations
3. Set up Cloud Functions for price fetching (if needed)
4. Configure deployment pipeline with Vercel or Cloudflare Pages

## Security Best Practices

1. **Never commit `.env` file to git**
2. **Use environment variables for all secrets**
3. **Regularly review Firestore security rules**
4. **Enable billing alerts to avoid unexpected charges**
5. **Use least-privilege principle for service accounts**