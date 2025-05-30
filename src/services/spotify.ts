import { db, auth } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Types
export interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  expiresAt: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  album: {
    id: string;
    name: string;
    images: Array<{
      height: number;
      width: number;
      url: string;
    }>;
  };
  artists: Array<{
    id: string;
    name: string;
  }>;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  duration_ms: number;
}

export interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  duration_ms: number;
  time_signature: number;
}

// Spotify API base URL
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Store the client credentials token and its expiration
let clientCredentialsToken = {
  access_token: '',
  expires_at: 0
};

/**
 * Get an access token using client credentials flow (app-level access)
 * This allows the app to make requests to Spotify without user authentication
 */
export const getClientCredentialsToken = async (): Promise<string> => {
  try {
    // Check if we have a valid token already
    if (clientCredentialsToken.access_token && Date.now() < clientCredentialsToken.expires_at) {
      return clientCredentialsToken.access_token;
    }
    
    // Request a new token from the server
    const response = await fetch('/api/spotify/client-token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get Spotify client token');
    }
    
    const data = await response.json();
    
    // Calculate expiration time (subtract 60 seconds for safety)
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    
    // Update the stored token
    clientCredentialsToken = {
      access_token: data.access_token,
      expires_at: expiresAt
    };
    
    return data.access_token;
  } catch (error) {
    console.error('Error getting client credentials token:', error);
    throw error;
  }
};

/**
 * Get Spotify tokens from user document in Firestore
 */
export const getSpotifyTokens = async (): Promise<SpotifyToken | null> => {
  if (!auth.currentUser) return null;
  
  try {
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists() && userDoc.data().spotify?.tokens) {
      const tokens = userDoc.data().spotify.tokens as SpotifyToken;
      
      // Check if token is expired
      if (Date.now() > tokens.expiresAt) {
        // Token is expired, refresh it
        return refreshSpotifyToken(tokens.refresh_token);
      }
      
      return tokens;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Spotify tokens:', error);
    return null;
  }
};

/**
 * Refresh the Spotify access token
 */
export const refreshSpotifyToken = async (refreshToken: string): Promise<SpotifyToken | null> => {
  if (!auth.currentUser) return null;
  
  try {
    // In a real implementation, this should call a serverless function to protect the client secret
    // For now, we'll implement this as if we're calling our own API endpoint
    
    const response = await fetch('/api/spotify/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh Spotify token');
    }
    
    const data = await response.json();
    
    // Calculate expiration time
    const expiresAt = Date.now() + data.expires_in * 1000;
    const tokens: SpotifyToken = {
      ...data,
      expiresAt,
    };
    
    // Update tokens in Firestore
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userDocRef, {
      'spotify.tokens': tokens,
      'spotifyConnected': true,
    });
    
    return tokens;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return null;
  }
};

/**
 * Make authenticated request to Spotify API using either user token or client credentials
 */
export const spotifyFetch = async (endpoint: string, options: RequestInit = {}, useClientCredentials = false): Promise<any> => {
  let accessToken = '';
  
  if (useClientCredentials) {
    // Use client credentials (app-level access)
    accessToken = await getClientCredentialsToken();
  } else {
    // Try to use user's tokens if available
    const tokens = await getSpotifyTokens();
    if (!tokens) {
      // Fall back to client credentials if no user tokens
      accessToken = await getClientCredentialsToken();
    } else {
      accessToken = tokens.access_token;
    }
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('Spotify API error:', data);
    throw new Error(data.error?.message || 'Error from Spotify API');
  }
  
  return data;
};

/**
 * Search for tracks on Spotify
 */
export const searchTracks = async (query: string, limit = 10): Promise<SpotifyTrack[]> => {
  try {
    // Always use client credentials for search (doesn't require user auth)
    const data = await spotifyFetch(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {},
      true // Use client credentials
    );
    
    return data.tracks.items;
  } catch (error) {
    console.error('Error searching tracks:', error);
    return [];
  }
};

/**
 * Get audio features for a track
 * NOTE: Spotify API no longer allows audio features access for most applications
 * This returns intelligent placeholder data based on available song metadata
 */
export const getAudioFeatures = async (trackId: string, mood?: string, genre?: string): Promise<SpotifyAudioFeatures | null> => {
  try {
    console.log('🎵 Getting audio features for track:', trackId);
    
    // TODO: Replace with actual API call when/if Spotify access becomes available
    // For now, generate intelligent placeholder data
    const placeholderFeatures = generatePlaceholderAudioFeatures(trackId, mood, genre);
    
    console.log('🎵 Using placeholder audio features:', placeholderFeatures);
    return placeholderFeatures;
    
  } catch (error) {
    console.error('Error getting audio features:', error);
    return null;
  }
};

/**
 * Generate intelligent placeholder audio features based on available metadata
 * This ensures consistent behavior while maintaining the data structure
 */
const generatePlaceholderAudioFeatures = (trackId: string, mood?: string, genre?: string): SpotifyAudioFeatures => {
  // Create deterministic but varied features based on track ID
  // This ensures the same track always gets the same features
  const seed = hashString(trackId);
  const random = createSeededRandom(seed);
  
  // Base features (moderate values)
  let valence = 0.5;  // happiness/positivity
  let energy = 0.6;   // intensity/power
  let danceability = 0.6; // how danceable
  let acousticness = 0.3; // acoustic vs electric
  let tempo = 120;    // BPM
  
  // Adjust based on mood if provided
  if (mood) {
    const moodAdjustments = getMoodAdjustments(mood.toLowerCase());
    valence = Math.max(0, Math.min(1, valence + moodAdjustments.valence + (random() - 0.5) * 0.3));
    energy = Math.max(0, Math.min(1, energy + moodAdjustments.energy + (random() - 0.5) * 0.3));
    danceability = Math.max(0, Math.min(1, danceability + moodAdjustments.danceability + (random() - 0.5) * 0.3));
    acousticness = Math.max(0, Math.min(1, acousticness + moodAdjustments.acousticness + (random() - 0.5) * 0.3));
    tempo = Math.max(60, Math.min(200, tempo + moodAdjustments.tempo + (random() - 0.5) * 40));
  }
  
  // Add some variation based on track ID to make each song unique
  valence += (random() - 0.5) * 0.2;
  energy += (random() - 0.5) * 0.2;
  danceability += (random() - 0.5) * 0.2;
  acousticness += (random() - 0.5) * 0.2;
  tempo += (random() - 0.5) * 20;
  
  // Ensure values are within valid ranges
  return {
    valence: Math.max(0, Math.min(1, valence)),
    energy: Math.max(0, Math.min(1, energy)),
    danceability: Math.max(0, Math.min(1, danceability)),
    acousticness: Math.max(0, Math.min(1, acousticness)),
    tempo: Math.max(60, Math.min(200, tempo)),
    
    // Additional Spotify audio features (reasonable defaults)
    key: Math.floor(random() * 12), // 0-11 (C, C#, D, etc.)
    loudness: -8 + (random() - 0.5) * 10, // dB, typically -60 to 0
    mode: random() > 0.5 ? 1 : 0, // 1 = major, 0 = minor
    speechiness: random() * 0.3, // 0-1, most music is low
    instrumentalness: random() * 0.8, // 0-1, most songs have vocals
    liveness: 0.1 + random() * 0.3, // 0-1, most songs are studio recorded
    time_signature: random() > 0.8 ? 3 : 4 // 3/4 or 4/4 time
  };
};

/**
 * Get mood-based adjustments for audio features
 */
const getMoodAdjustments = (mood: string): {
  valence: number;
  energy: number;
  danceability: number;
  acousticness: number;
  tempo: number;
} => {
  const adjustments: { [key: string]: any } = {
    'happy': { valence: 0.3, energy: 0.2, danceability: 0.2, acousticness: -0.1, tempo: 10 },
    'energetic': { valence: 0.2, energy: 0.4, danceability: 0.3, acousticness: -0.2, tempo: 20 },
    'chill': { valence: 0.1, energy: -0.3, danceability: -0.2, acousticness: 0.2, tempo: -20 },
    'sad': { valence: -0.4, energy: -0.2, danceability: -0.3, acousticness: 0.1, tempo: -15 },
    'nostalgic': { valence: -0.1, energy: -0.1, danceability: -0.1, acousticness: 0.2, tempo: -10 },
    'romantic': { valence: 0.2, energy: -0.1, danceability: 0.1, acousticness: 0.1, tempo: -5 },
    'angry': { valence: -0.3, energy: 0.3, danceability: 0.1, acousticness: -0.2, tempo: 15 },
    'peaceful': { valence: 0.1, energy: -0.4, danceability: -0.3, acousticness: 0.3, tempo: -25 },
    'excited': { valence: 0.3, energy: 0.3, danceability: 0.3, acousticness: -0.1, tempo: 15 },
    'reflective': { valence: -0.1, energy: -0.2, danceability: -0.2, acousticness: 0.2, tempo: -10 }
  };
  
  return adjustments[mood] || { valence: 0, energy: 0, danceability: 0, acousticness: 0, tempo: 0 };
};

/**
 * Create a simple hash from a string for deterministic randomness
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Create a seeded random number generator
 */
const createSeededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
    return state / Math.pow(2, 32);
  };
};

/**
 * Get track details
 */
export const getTrack = async (trackId: string): Promise<SpotifyTrack | null> => {
  try {
    // Use client credentials by default (doesn't require user auth)
    return await spotifyFetch(`/tracks/${trackId}`, {}, true);
  } catch (error) {
    console.error('Error getting track:', error);
    return null;
  }
};

/**
 * Connect user to Spotify
 */
export const connectToSpotify = (): void => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/spotify';
  
  // Define scopes needed for the application
  const scopes = [
    'user-read-private',
    'user-read-email',
    'user-top-read',
    'user-library-read',
  ].join(' ');
  
  // Create the authorization URL
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('client_id', clientId as string);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('scope', scopes);
  
  // Redirect the user to the Spotify authorization page
  window.location.href = authUrl.toString();
};

/**
 * Enhanced search for tracks with preview URLs using spotify-preview-finder
 * This function tries the standard Spotify API first, then enhances results with preview finder
 */
export const searchTracksWithPreviews = async (query: string, limit = 10): Promise<SpotifyTrack[]> => {
  try {
    console.log('🎵 Starting enhanced search for:', query);
    
    // First, try the standard Spotify API search
    const standardTracks = await searchTracks(query, limit);
    console.log('🎵 Standard Spotify API returned:', standardTracks.length, 'tracks');
    
    // If we have no tracks from standard API, return empty array
    if (!standardTracks || standardTracks.length === 0) {
      console.log('🎵 No tracks from standard API, trying preview finder...');
      
      try {
        // Try using spotify-preview-finder as a fallback
        const spotifyPreviewFinder = require('spotify-preview-finder');
        const previewResult = await spotifyPreviewFinder(query, limit);
        
        if (previewResult.success && previewResult.results.length > 0) {
          console.log('🎵 Preview finder returned:', previewResult.results.length, 'results');
          
          // Convert preview finder results to our SpotifyTrack format
          const enhancedTracks: SpotifyTrack[] = previewResult.results.map((result: any) => {
            // Extract track info from the combined name string
            const nameParts = result.name.split(' - ');
            const trackName = nameParts[0] || result.name;
            const artistName = nameParts[1] || 'Unknown Artist';
            
            return {
              id: result.spotifyUrl.split('/').pop() || `preview_${Date.now()}`,
              name: trackName,
              album: {
                id: '',
                name: 'Unknown Album',
                images: []
              },
              artists: [{
                id: '',
                name: artistName
              }],
              preview_url: result.previewUrls[0] || null,
              external_urls: {
                spotify: result.spotifyUrl
              },
              duration_ms: 30000 // Default to 30 seconds for previews
            };
          });
          
          return enhancedTracks;
        }
      } catch (previewError) {
        console.log('🎵 Preview finder failed:', previewError);
      }
      
      return [];
    }
    
    // Enhance existing tracks with preview finder if they don't have preview URLs
    console.log('🎵 Enhancing tracks with preview finder...');
    const enhancedTracks = await Promise.all(
      standardTracks.map(async (track) => {
        // If track already has a preview URL, return as is
        if (track.preview_url) {
          console.log(`🎵 Track "${track.name}" already has preview URL`);
          return track;
        }
        
        try {
          // Try to find preview URL for this specific track
          const spotifyPreviewFinder = require('spotify-preview-finder');
          const searchQuery = `${track.name} ${track.artists[0]?.name || ''}`.trim();
          const previewResult = await spotifyPreviewFinder(searchQuery, 1);
          
          if (previewResult.success && previewResult.results.length > 0) {
            const previewUrl = previewResult.results[0].previewUrls[0];
            console.log(`🎵 Found preview URL for "${track.name}":`, previewUrl);
            
            return {
              ...track,
              preview_url: previewUrl
            };
          } else {
            console.log(`🎵 No preview found for "${track.name}"`);
            return track;
          }
        } catch (error) {
          console.log(`🎵 Error finding preview for "${track.name}":`, error);
          return track;
        }
      })
    );
    
    console.log('🎵 Enhanced search complete. Tracks with previews:', 
      enhancedTracks.filter(t => t.preview_url).length, 'out of', enhancedTracks.length);
    
    return enhancedTracks;
  } catch (error) {
    console.error('🎵 Error in enhanced search:', error);
    // Fallback to standard search
    return searchTracks(query, limit);
  }
}; 