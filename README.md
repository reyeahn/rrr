# Resonate

A social music sharing platform where users can post their daily songs, discover new music, and connect with others who share similar musical tastes.

## ✅ Current Status - Working Features

### 🎵 Spotify Integration
- **Song Search**: Enhanced search using Spotify API with fallback to spotify-preview-finder
- **Audio Previews**: 30-second song previews for most tracks
- **Album Artwork**: Automatic album cover extraction with fallback to default image
- **Real-time Search**: Instant search results as you type

### 🎧 Music Features
- **Post Daily Song**: Share your song of the day with mood and caption
- **Audio Player**: Built-in player with play/pause and progress controls
- **Preview URLs**: Working preview playback for Bruno Mars and other popular artists

### 👥 User System
- **Firebase Authentication**: Email/password and social login
- **User Profiles**: Customizable profiles with preferences
- **Onboarding**: Music preference questionnaire for new users

### 🎨 UI/UX
- **Modern Design**: Clean, responsive interface with dark/light mode
- **Mobile Optimized**: Touch-friendly interface for all devices
- **Loading States**: Smooth loading animations and feedback

## 🔧 Recent Fixes (Just Completed)

1. **Album Artwork**: Fixed 404 errors with proper fallback images
2. **Favicon**: Added proper favicon to eliminate browser errors
3. **Enhanced Search**: Integrated spotify-preview-finder for better preview URL coverage
4. **Environment Variables**: Fixed all Spotify API authentication issues

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Firebase account
- Spotify Developer account

### Environment Variables
Create a `.env.local` file in the root directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Spotify API Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Access the Application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## 📱 Features in Development

- **Social Feed**: View and interact with friends' daily songs
- **Music Matching**: AI-powered music compatibility matching
- **Collaborative Playlists**: Create and share playlists with friends
- **Advanced Analytics**: Music taste analysis and insights

## 🎵 How It Works

1. **Sign Up**: Create an account and complete the music preference onboarding
2. **Search Songs**: Use the Spotify-powered search to find any song
3. **Post Daily Song**: Share your song of the day with mood and caption
4. **Listen to Previews**: Play 30-second previews directly in the app
5. **Discover Music**: Browse other users' posts and discover new music

## 🔊 Spotify Integration Details

The app uses multiple APIs to ensure the best music experience:

- **Primary**: Spotify Web API for official song data and previews
- **Enhanced**: spotify-preview-finder for additional preview URLs
- **Fallback**: Comprehensive error handling and mock data when needed

## 🛠 Technical Stack

- **Frontend**: Next.js 13, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Firebase Functions
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Music API**: Spotify Web API + spotify-preview-finder

## 📞 Support

If you encounter any issues:

1. Check the browser console for detailed logging (🎵 prefixed messages)
2. Verify your environment variables are set correctly
3. Ensure your Spotify Developer App has the correct redirect URIs

---

**Status**: ✅ Core functionality working - Search, Preview, and Posting all operational! 
