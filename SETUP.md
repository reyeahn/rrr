# Music App - Setup Guide

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd musicapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (see below)

4. **Run development server**
   ```bash
   npm run dev
   ```

## 🔧 Environment Variables Setup

Create a `.env.local` file in the project root with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (for server-side)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key\n-----END PRIVATE KEY-----\n"

# Spotify API
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback/spotify

# OpenAI API (optional)
OPENAI_API_KEY=your_openai_api_key
```

## 📋 Required API Keys

### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or use existing
3. Enable Authentication and Firestore Database
4. Get your config from Project Settings > General
5. Create a service account key from Project Settings > Service Accounts

### 2. Spotify API Setup
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3000/api/auth/callback/spotify` to redirect URIs
4. Get your Client ID and Client Secret

### 3. OpenAI API Setup (Optional)
1. Go to [OpenAI Platform](https://platform.openai.com)
2. Create API key
3. Add billing information (required for API access)

## 🔐 Security Notes

- **NEVER commit your `.env.local` file to git**
- **Keep your API keys secure**
- **Use different Firebase projects for development/production**

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

## 📱 Features

- **User Authentication** (Email/Google)
- **Daily Song Posting** with Spotify integration
- **Intelligent Matching Algorithm** based on music preferences
- **AI-Powered Analytics** using OpenAI
- **Real-time Social Features** (matches, friends, comments)
- **Pacific Time-based Daily Reset** (9 AM PST)

## 🏗️ Tech Stack

- **Frontend**: Next.js 13, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Firebase Functions
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Music Data**: Spotify Web API
- **AI Integration**: OpenAI GPT-4
- **Hosting**: Vercel (recommended)

## 🚨 Troubleshooting

### Common Issues

1. **Firebase Permission Errors**
   - Check your Firestore security rules
   - Ensure service account has proper permissions

2. **Spotify API 403 Errors**
   - Verify your client credentials
   - Check redirect URI matches exactly

3. **OpenAI API Errors**
   - Ensure you have billing set up
   - Check API key is valid and has credits

4. **Build Errors**
   - Delete `.next` folder and `node_modules`
   - Run `npm install` again
   - Check TypeScript errors with `npm run type-check`

### Getting Help

If you encounter issues:
1. Check the browser console for errors
2. Check the terminal for build errors
3. Verify all environment variables are set correctly
4. Ensure all required APIs are enabled

## 📞 Support

For issues with setup, check:
- Firebase Console for database/auth issues
- Spotify Developer Dashboard for API issues
- OpenAI Platform for AI-related issues 