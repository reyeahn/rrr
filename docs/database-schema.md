# MusicConnect Database Schema

This document outlines the database schema for the MusicConnect application. The database is implemented in Firebase Firestore, a NoSQL document database.

## Collections

### Users

Stores user information, preferences, and account details.

```typescript
interface User {
  uid: string;                           // Unique identifier (from Firebase Auth)
  displayName: string;                   // User's display name
  email: string;                         // User's email address
  emailVerified: boolean;                // Whether email is verified
  photoURL: string | null;               // Profile photo URL
  createdAt: Timestamp;                  // Account creation timestamp
  lastActive: Timestamp;                 // Last activity timestamp
  bio: string;                           // User bio/description
  preferences: {
    theme: 'dark' | 'light' | 'system';  // UI theme preference
    notificationsEnabled: boolean;       // Push notification setting
    privacySettings: {
      postVisibility: 'public' | 'friends' | 'private';
      profileVisibility: 'public' | 'friends';
    };
  };
  questionnaire: {
    weekendSoundtrack: string;           // Onboarding response - music preference
    moodGenre: string;                   // Preferred genre when in a certain mood
    discoveryFrequency: string;          // How often user discovers new music
    favoriteSongMemory: string;          // Description of favorite song memory
    preferredMoodTag: string;            // Preferred mood tag for music
  };
  stats: {
    totalPosts: number;                  // Total posts made
    totalMatches: number;                // Total matches made
    totalLikes: number;                  // Total likes received
    totalComments: number;               // Total comments received
  };
  hasPostedToday: boolean;               // Limits to one post per day
  spotifyConnected: boolean;             // Whether Spotify is connected
  appleConnected: boolean;               // Whether Apple Music is connected
  
  // Optional fields for connected accounts
  spotify?: {
    tokens: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expiresAt: number;                 // Timestamp when token expires
    };
    profile: {
      id: string;
      displayName: string;
      email: string;
      images: Array<{url: string}>;
      country: string;
      product: string;
    };
  };
}
```

### Posts

Stores the daily song posts made by users.

```typescript
interface Post {
  id: string;                            // Unique post ID
  userId: string;                        // ID of user who created the post
  createdAt: Timestamp;                  // When post was created
  
  // Song information
  song: {
    title: string;                       // Song title
    artist: string;                      // Artist name
    album: string;                       // Album name
    albumArt: string;                    // URL to album art
    previewUrl?: string;                 // URL to preview audio
    durationMs: number;                  // Duration in milliseconds
    
    // Spotify-specific data if available
    spotifyId?: string;                  // Spotify track ID
    spotifyUrl?: string;                 // Spotify track URL
  };
  
  // User content
  caption: string;                       // User's caption for the post
  moodTag: string;                       // User-selected mood tag
  mediaUrl?: string;                     // Optional additional media
  
  // Engagement metrics
  stats: {
    views: number;                       // View count
    likes: number;                       // Like count
    comments: number;                    // Comment count
    matches: number;                     // Match count (swipe rights)
  };
  
  // Optional audio analysis from Spotify
  audioFeatures?: {
    danceability: number;                // 0.0 to 1.0
    energy: number;                      // 0.0 to 1.0
    valence: number;                     // 0.0 to 1.0 (positivity)
    tempo: number;                       // BPM
    // Other Spotify audio features...
  };
}
```

### Matches

Stores information about matches between users based on song posts.

```typescript
interface Match {
  id: string;                            // Unique match ID
  user1Id: string;                       // First user in the match
  user2Id: string;                       // Second user in the match
  post1Id: string;                       // Post from user1
  post2Id?: string;                      // Post from user2 (if they've matched back)
  createdAt: Timestamp;                  // When the match was created
  updatedAt: Timestamp;                  // When the match was last updated
  
  // Match status
  status: 'pending' | 'active' | 'rejected' | 'expired';
  
  // Chat activity
  lastMessage?: {
    text: string;                        // Last message text
    sentAt: Timestamp;                   // When last message was sent
    sentBy: string;                      // Who sent the last message
  };
  
  // Compatibility score (optional, calculated from post audio features)
  compatibilityScore?: number;           // 0-100 score
}
```

### Comments

Stores comments on posts.

```typescript
interface Comment {
  id: string;                            // Unique comment ID
  postId: string;                        // ID of the post being commented on
  userId: string;                        // ID of user who wrote the comment
  text: string;                          // Comment text
  createdAt: Timestamp;                  // When comment was created
  
  // Optional reference to another comment (for replies)
  replyTo?: string;                      // ID of parent comment if this is a reply
}
```

### Messages

Stores messages between matched users.

```typescript
interface Message {
  id: string;                            // Unique message ID
  matchId: string;                       // ID of the match conversation
  senderId: string;                      // ID of user who sent the message
  text: string;                          // Message text
  createdAt: Timestamp;                  // When message was sent
  readAt?: Timestamp;                    // When message was read
  
  // Optional attachments
  attachments?: Array<{
    type: 'image' | 'song';              // Attachment type
    url: string;                         // URL to attachment
    previewUrl?: string;                 // Preview URL for songs
  }>;
}
```

## Subcollections

Some data may be stored in subcollections for better organization:

- `/users/{userId}/privateData/` - Private user data
- `/posts/{postId}/comments/` - Comments on a specific post
- `/matches/{matchId}/messages/` - Messages in a specific match

## Indexes

For efficient queries, the following composite indexes should be created:

1. Posts by creation date:
   - Collection: `posts`
   - Fields: `createdAt` (descending)

2. User's posts:
   - Collection: `posts`
   - Fields: `userId` (ascending), `createdAt` (descending)

3. Messages in a match:
   - Collection: `messages`
   - Fields: `matchId` (ascending), `createdAt` (ascending)

4. User's matches:
   - Collection: `matches`
   - Fields: `user1Id` (ascending), `createdAt` (descending)
   - Fields: `user2Id` (ascending), `createdAt` (descending)

## Security Rules

Security rules for this schema are defined in `firestore.rules`. Key principles:

1. Users can only read/write their own data
2. Posts are publicly readable but only writable by the creator
3. Matches are only accessible to the two users involved
4. One post per day limit is enforced

See `firestore.rules` for the complete security implementation. 