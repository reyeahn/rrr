import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get the authorization header
  const authHeader = req.headers.authorization;
  
  // Check if auth header exists and starts with 'Bearer '
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Extract the token
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // Verify the Firebase ID token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // Get refresh token from request body
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }
    
    // Exchange refresh token for new access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error refreshing token:', errorData);
      return res.status(500).json({ error: 'Failed to refresh token' });
    }
    
    const tokenData = await tokenResponse.json();
    
    // Calculate expiration time
    const expiresAt = Date.now() + tokenData.expires_in * 1000;
    
    // Create the updated tokens object
    const updatedTokens = {
      ...tokenData,
      refresh_token: tokenData.refresh_token || refreshToken, // Use new refresh token if provided, else use old one
      expiresAt,
    };
    
    // Update the tokens in the user's document
    await db.collection('users').doc(uid).update({
      'spotify.tokens': updatedTokens,
    });
    
    // Return the new tokens to the client
    return res.status(200).json(updatedTokens);
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
} 