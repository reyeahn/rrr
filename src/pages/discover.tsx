import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { FaHeart, FaTimes, FaPlay, FaPause, FaUser } from 'react-icons/fa';
import { getUnswiped, recordSwipe } from '@/services/swipes';
import { getIntelligentMatches } from '@/services/matchingAlgorithm';
import ClickableAlbumCover from '@/components/spotify/ClickableAlbumCover';

interface Post {
  id: string;
  userId: string;
  userName?: string;
  userPhotoURL?: string;
  song: {
    title: string;
    artist: string;
    album: string;
    coverArtUrl: string;
    spotifyId?: string;
    previewUrl?: string;
  };
  caption: string;
  mediaUrl?: string;
  audioFeatures?: {
    valence: number;
    energy: number;
    tempo: number;
    danceability: number;
  };
  moodTags?: string[];
}

const Discover: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [matchFound, setMatchFound] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const router = useRouter();
  const { user, userData, refreshUserData } = useAuth();

  // If user is not logged in, redirect to home
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    
    // If userData hasn't loaded yet, wait for it
    if (userData === undefined) {
      return;
    }
    
    // Simple check: if user hasn't posted today, redirect to post-song
    if (userData && userData.hasPostedToday === false) {
      router.push('/post-song');
    }
  }, [user, userData, router]);

  // Fetch posts from Firestore using intelligent matching
  useEffect(() => {
    const fetchPosts = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      try {
        // First try intelligent matching algorithm (max 15 posts per day)
        const intelligentMatches = await getIntelligentMatches(user.uid);
        
        if (intelligentMatches.length > 0) {
          // Convert to the format expected by the UI
          const fetchedPosts: Post[] = [];
          
          for (const match of intelligentMatches) {
            try {
              // Get user details for the post author
              const userDoc = await getDoc(doc(db, 'users', match.userId));
              const userData = userDoc.exists() ? userDoc.data() : null;
              
              fetchedPosts.push({
                id: match.id,
                userId: match.userId,
                userName: userData?.displayName || 'User',
                userPhotoURL: userData?.photoURL || undefined,
                song: {
                  title: match.song.title,
                  artist: match.song.artist,
                  album: '',
                  coverArtUrl: match.song.coverArtUrl || '',
                  spotifyId: match.song.spotifyId || '',
                  previewUrl: match.song.previewUrl || ''
                },
                caption: match.caption || '',
                mediaUrl: undefined,
                audioFeatures: match.song.audioFeatures,
                moodTags: match.moodTags || [match.mood]
              });
            } catch (err) {
              console.error(`Error processing intelligent match ${match.id}:`, err);
            }
          }
          
          setPosts(fetchedPosts);
          setIsLoading(false);
          return;
        }
        
        // Fallback to original method if intelligent matching returns no results
        console.log('No intelligent matches found, falling back to original method');
        
        // Get IDs of posts that haven't been swiped yet
        const unswipedPostIds = await getUnswiped(user.uid);
        
        if (unswipedPostIds.length === 0) {
          setPosts([]);
          setIsLoading(false);
          return;
        }
        
        // Limit to 15 posts maximum per day
        const limitedPostIds = unswipedPostIds.slice(0, 15);
        
        // Fetch full post data for each unswiped post
        const fetchedPosts: Post[] = [];
        
        for (const postId of limitedPostIds) {
          try {
            const postDoc = await getDoc(doc(db, 'posts', postId));
            
            if (postDoc.exists()) {
              const postData = postDoc.data();
              
              // Get user details
              const userDoc = await getDoc(doc(db, 'users', postData.userId));
              const userData = userDoc.exists() ? userDoc.data() : null;
              
              fetchedPosts.push({
                id: postDoc.id,
                userId: postData.userId,
                userName: userData?.displayName || 'User',
                userPhotoURL: userData?.photoURL || undefined,
                song: postData.song ? {
                  title: postData.song.title || postData.songTitle || '',
                  artist: postData.song.artist || postData.songArtist || '',
                  album: postData.song.album || '',
                  coverArtUrl: postData.song.coverArtUrl || postData.songAlbumArt || '',
                  spotifyId: postData.song.spotifyId || postData.spotifyId || '',
                  previewUrl: postData.song.previewUrl || postData.previewUrl || ''
                } : {
                  title: postData.songTitle || '',
                  artist: postData.songArtist || '',
                  album: '',
                  coverArtUrl: postData.songAlbumArt || '',
                  spotifyId: postData.spotifyId || '',
                  previewUrl: postData.previewUrl || ''
                },
                caption: postData.caption || '',
                mediaUrl: postData.mediaUrl,
                audioFeatures: postData.audioFeatures,
                moodTags: postData.moodTags || []
              });
            }
          } catch (err) {
            console.error(`Error fetching post ${postId}:`, err);
          }
        }
        
        setPosts(fetchedPosts);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPosts();
  }, [user]);

  // Handle audio playback
  useEffect(() => {
    // Stop audio when changing cards
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentIndex]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    if ('touches' in e) {
      setStartX(e.touches[0].clientX);
    } else {
      setStartX(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    let currentX;
    if ('touches' in e) {
      currentX = e.touches[0].clientX;
    } else {
      currentX = e.clientX;
    }
    
    const diff = currentX - startX;
    setOffsetX(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // If swiped far enough, handle like/dislike
    if (offsetX > 100) {
      handleLike();
    } else if (offsetX < -100) {
      handleDislike();
    }
    
    // Reset position
    setOffsetX(0);
  };

  const handleLike = async () => {
    if (currentIndex >= posts.length || !user) return;
    
    try {
      const post = posts[currentIndex];
      
      // Record the swipe in Firestore and check for a match
      const matchId = await recordSwipe(
        user.uid,
        post.id,
        post.userId,
        'right'
      );
      
      // If there's a match, show it
      if (matchId) {
        setMatchFound(matchId);
        
        // Store this match in local storage to ensure we can recover if navigation fails
        try {
          localStorage.setItem('lastMatchId', matchId);
          localStorage.setItem('lastMatchTime', new Date().toISOString());
        } catch (storageError) {
          console.error('Failed to store match in localStorage:', storageError);
        }
        
        // After a few seconds, hide the match animation and continue to the next post
        setTimeout(() => {
          setMatchFound(null);
          setCurrentIndex(currentIndex + 1);
        }, 3000);
      } else {
        // Just move to next post
        setCurrentIndex(currentIndex + 1);
      }
    } catch (error) {
      console.error('Error recording like:', error);
      // Still move to next post even if there's an error
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDislike = async () => {
    if (currentIndex >= posts.length || !user) return;
    
    try {
      const post = posts[currentIndex];
      
      // Record the swipe in Firestore
      await recordSwipe(
        user.uid,
        post.id,
        post.userId,
        'left'
      );
      
      // Move to next post
      setCurrentIndex(currentIndex + 1);
    } catch (error) {
      console.error('Error recording dislike:', error);
      // Still move to next post even if there's an error
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Calculate card styles based on drag position
  const cardStyle = {
    transform: `translateX(${offsetX}px) rotate(${offsetX * 0.05}deg)`,
    opacity: offsetX !== 0 ? 1 - Math.min(Math.abs(offsetX) / 500, 0.5) : 1,
  };

  if (!user) return null;

  // Display loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col justify-center items-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        <p className="mt-4 text-gray-700 dark:text-gray-300">Loading posts...</p>
      </div>
    );
  }

  // Match found overlay
  if (matchFound) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col justify-center items-center p-4 text-center">
        <div className="max-w-sm bg-white dark:bg-dark-200 p-8 rounded-xl shadow-lg animate-bounce">
          <div className="h-20 w-20 mx-auto bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mb-4">
            <FaHeart className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            It's a Match!
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            You both liked each other's music taste. Start a conversation and connect through music!
          </p>
        </div>
      </div>
    );
  }

  // All cards viewed
  if (currentIndex >= posts.length) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col justify-center items-center p-4 text-center">
        <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
          <FaHeart className="h-10 w-10 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You've seen all posts for today!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Come back tomorrow to discover more music connections.
        </p>
        <button
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          onClick={() => router.push('/matches')}
        >
          Go to Matches
        </button>
      </div>
    );
  }

  // Current post
  const currentPost = posts[currentIndex];

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col pt-16 pb-8 px-4">
      {/* Song card */}
      <div className="relative flex-grow flex justify-center items-center">
        <div
          ref={cardRef}
          className="max-w-sm w-full bg-white dark:bg-dark-200 rounded-xl shadow-lg overflow-hidden touch-none"
          style={cardStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
        >
          {/* Cover art */}
          <div className="relative w-full aspect-square">
            <ClickableAlbumCover
              coverArtUrl={currentPost.song.coverArtUrl}
              previewUrl={currentPost.song.previewUrl}
              songTitle={currentPost.song.title}
              songArtist={currentPost.song.artist}
              size="large"
              className="w-full h-full object-cover rounded-lg"
            />
            
            {/* Play button overlay */}
            {currentPost.song.previewUrl && (
              <button
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 transition-opacity hover:bg-opacity-40"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
              >
                {isPlaying ? (
                  <FaPause className="h-16 w-16 text-white opacity-80" />
                ) : (
                  <FaPlay className="h-16 w-16 text-white opacity-80" />
                )}
              </button>
            )}
            
            {/* Audio element (hidden) */}
            {currentPost.song.previewUrl && (
              <audio
                ref={audioRef}
                src={currentPost.song.previewUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            )}
          </div>
          
          {/* Song info */}
          <div className="p-4">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-300 dark:bg-gray-600">
                {currentPost.userPhotoURL ? (
                  <img
                    src={currentPost.userPhotoURL}
                    alt={currentPost.userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FaUser className="h-5 w-5 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {currentPost.userName}
                </h3>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {currentPost.song.title}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {currentPost.song.artist}
            </p>
            
            {currentPost.caption && (
              <p className="text-gray-600 dark:text-gray-400 italic mb-3">
                "{currentPost.caption}"
              </p>
            )}
            
            {/* Mood tags */}
            {currentPost.moodTags && currentPost.moodTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {currentPost.moodTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-100 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            
            {/* Media attachment if exists */}
            {currentPost.mediaUrl && (
              <div className="mt-3 rounded-lg overflow-hidden">
                <img
                  src={currentPost.mediaUrl}
                  alt="Attached media"
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-center items-center gap-8 mt-6">
        <button
          className="w-16 h-16 flex items-center justify-center bg-white dark:bg-dark-200 text-red-500 rounded-full shadow-lg transform transition-transform hover:scale-110"
          onClick={handleDislike}
        >
          <FaTimes className="h-8 w-8" />
        </button>
        
        <button
          className="w-16 h-16 flex items-center justify-center bg-white dark:bg-dark-200 text-green-500 rounded-full shadow-lg transform transition-transform hover:scale-110"
          onClick={handleLike}
        >
          <FaHeart className="h-8 w-8" />
        </button>
      </div>
      
      {/* Card counter */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {currentIndex + 1} of {posts.length}
        </p>
      </div>
    </div>
  );
};

export default Discover; 