import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { q: query, limit = 10 } = req.query;
  
  console.log('🎵 SEARCH: Starting search for:', query, 'limit:', limit);
  
  if (!query || typeof query !== 'string') {
    console.log('🎵 SEARCH: Invalid query parameter');
    return res.status(400).json({ error: 'Query parameter (q) is required' });
  }
  
  try {
    console.log('🎵 SEARCH: Getting client credentials directly...');
    
    // Get client credentials from environment variables
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('🎵 SEARCH: Missing Spotify credentials');
      return res.status(500).json({ error: 'Spotify credentials not configured' });
    }

    // Get client credentials token directly
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });

    console.log('🎵 SEARCH: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.json();
      console.error('🎵 SEARCH: Failed to get client token:', tokenError);
      throw new Error('Failed to get Spotify client token');
    }
    
    const tokenData = await tokenResponse.json();
    console.log('🎵 SEARCH: Token obtained, making Spotify API call...');
    
    // Search for tracks using Spotify API
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`;
    console.log('🎵 SEARCH: Search URL:', searchUrl);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    console.log('🎵 SEARCH: Spotify API response status:', searchResponse.status);

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('🎵 SEARCH: Spotify API error:', errorData);
      throw new Error(errorData.error?.message || 'Error from Spotify API');
    }
    
    const searchData = await searchResponse.json();
    console.log('🎵 SEARCH: Search successful, tracks found:', searchData.tracks?.items?.length || 0);
    
    return res.status(200).json(searchData);
    
  } catch (error) {
    console.error('🎵 SEARCH: Error in Spotify search:', error);
    return res.status(500).json({ error: 'Failed to search Spotify' });
  }
} 