import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { FaUser, FaCog, FaEdit, FaSignOutAlt, FaMusic, FaHeart, FaComment, FaRegHeart, FaLock, FaGlobe, FaChartLine, FaPhone } from 'react-icons/fa';
import { getUserProfilePosts, getAllUserPosts } from '@/services/posts';
import { likePost, addComment, getPostComments } from '@/services/posts';
import { getUserFriends } from '@/services/friends';
import NotificationBadge from '@/components/common/NotificationBadge';
import { getUnreadNotifications } from '@/services/notifications';
import ClickableAlbumCover from '@/components/spotify/ClickableAlbumCover';
import { formatPostDate } from '@/services/timeUtils';
import WeeklyInsights from '@/components/analytics/WeeklyInsights';
import PhotoCarousel from '@/components/PhotoCarousel';

interface Post {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string;
  songTitle: string;
  songArtist: string;
  songAlbumArt: string;
  spotifyId?: string;
  previewUrl?: string;
  mood: string;
  caption: string;
  likes: number;
  comments: number;
  createdAt: Date;
  likedBy?: string[];
  mediaUrl?: string; // Keep for backward compatibility
  mediaUrls?: string[]; // New field for multiple photos
}

const Profile: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { user, userData, logout } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<{[key: string]: any[]}>({});
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState<{[key: string]: boolean}>({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [postsVisibility, setPostsVisibility] = useState<'public' | 'private'>('public');
  const [activeTab, setActiveTab] = useState<'posts' | 'analytics'>('posts');
  const [friendCount, setFriendCount] = useState(0);
  const [totalPostsCount, setTotalPostsCount] = useState(0);

  useEffect(() => {
    if (userData) {
      setName(userData.displayName || '');
      setBio(userData.bio || '');
      setPostsVisibility(userData.settings?.postsVisibility || 'public');
    }
  }, [userData]);

  useEffect(() => {
    if (user) {
      fetchUserPosts();
      fetchNotifications();
      fetchFriendCount();
      fetchTotalPostsCount();
    }
  }, [user]);

  const fetchUserPosts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch real user posts from Firestore
      const userPosts = await getUserProfilePosts(user.uid);
      
      if (userPosts.length > 0) {
        setPosts(userPosts);
      } else {
        console.log('No posts found for this user');
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
      
      // Fallback to mocks only if there's an error and no UI is showing
      if (posts.length === 0) {
        const mockUserPosts: Post[] = [
          {
            id: 'userpost1',
            userId: user.uid,
            userDisplayName: userData?.displayName || user.displayName || 'User',
            userPhotoURL: userData?.photoURL || user.photoURL || '',
            songTitle: 'White Ferrari',
            songArtist: 'Frank Ocean',
            songAlbumArt: 'https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526',
            mood: 'Nostalgic',
            caption: 'This song takes me back to summer nights...',
            likes: 27,
            comments: 5,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            likedBy: ['friend1', 'friend2'],
          },
          // Additional mock posts as fallback
        ];
        setPosts(mockUserPosts);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      // Get real unread notifications count using the service
      const notifications = await getUnreadNotifications(user.uid);
      setUnreadNotifications(notifications.length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Fallback to a default value
      setUnreadNotifications(0);
    }
  };

  const fetchFriendCount = async () => {
    if (!user) return;
    
    try {
      const friends = await getUserFriends(user.uid);
      setFriendCount(friends.length);
    } catch (error) {
      console.error('Error fetching friend count:', error);
      setFriendCount(0);
    }
  };

  const fetchTotalPostsCount = async () => {
    if (!user) return;
    
    try {
      const totalPosts = await getAllUserPosts(user.uid);
      setTotalPostsCount(totalPosts.length);
    } catch (error) {
      console.error('Error fetching total posts count:', error);
      setTotalPostsCount(0);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: name,
        bio: bio
      });
      
      setIsEditing(false);
      
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successMessage.textContent = 'Profile updated successfully!';
      document.body.appendChild(successMessage);
      setTimeout(() => {
        if (successMessage.parentElement) {
          successMessage.parentElement.removeChild(successMessage);
        }
      }, 3000);
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      
      // Use the enhanced error handler
      const errorType = handleFirestoreError(error, 'profile update');
      
      if (errorType === 'blocked') {
        // Ad blocker notification already shown by handleFirestoreError
        return;
      }
      
      // Show error for other types of failures
      let errorMessage = 'Failed to update profile. ';
      
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please refresh the page and try again.';
      } else if (error.code === 'unavailable') {
        errorMessage += 'Service temporarily unavailable. Please check your internet connection and try again.';
      } else {
        errorMessage += 'Please try again. If the problem persists, try refreshing the page.';
      }
      
      // Show error dialog for non-ad-blocker errors
      const errorDialog = document.createElement('div');
      errorDialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      errorDialog.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md mx-4">
          <h3 class="text-lg font-bold text-red-600 mb-2">Profile Update Failed</h3>
          <p class="text-gray-700 dark:text-gray-300 mb-4">${errorMessage}</p>
          <div class="flex gap-2">
            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                    class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
              OK
            </button>
            <button onclick="window.location.reload()" 
                    class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Refresh Page
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(errorDialog);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;

    try {
      // Find the post to update locally
      const post = posts.find(p => p.id === postId);
      
      if (!post) return;
      
      // Check if user has already liked the post
      const userLiked = post.likedBy?.includes(user.uid);
      
      // Call the real likePost service to update Firestore
      await likePost(postId, user.uid);
      
      // Update local state for immediate UI feedback
      if (userLiked) {
        // User already liked the post, so unlike it
        setPosts(posts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likes: Math.max(0, post.likes - 1),
                likedBy: post.likedBy?.filter(id => id !== user.uid) || []
              }
            : post
        ));
      } else {
        // User hasn't liked the post, so like it
        setPosts(posts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likes: post.likes + 1,
                likedBy: [...(post.likedBy || []), user.uid]
              }
            : post
        ));
      }
    } catch (error) {
      console.error('Error liking post:', error);
      // Optionally refresh posts to ensure UI is in sync with backend
      fetchUserPosts();
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !newComment.trim()) return;

    try {
      // Call the real addComment service
      const commentId = await addComment(
        postId,
        user.uid,
        newComment.trim()
      );
      
      // Get the user's display name and photo URL for the new comment
      const userDisplayName = userData?.displayName || user.displayName || 'You';
      const userPhotoURL = userData?.photoURL || user.photoURL;
      
      // Create a new comment object
      const newCommentObj = {
        id: commentId,
        postId,
        userId: user.uid,
        userDisplayName,
        userPhotoURL,
        content: newComment.trim(),
        createdAt: new Date(),
      };
      
      // Add the comment to the local state
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newCommentObj]
      }));
      
      // Update the post's comment count in the local state
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, comments: post.comments + 1 }
          : post
      ));
      
      // Clear the input
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      // Call the real getPostComments service
      const postComments = await getPostComments(postId);
      
      // Update the comments state with the fetched comments
      setComments(prev => ({ 
        ...prev, 
        [postId]: postComments 
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      
      // Fallback to mocks only if necessary
      const mockComments = [
        {
          id: `mock-${Date.now()}`,
          postId,
          userId: 'mock-user',
          userDisplayName: 'Example User',
          userPhotoURL: 'https://i.pravatar.cc/150?img=1',
          content: 'This is a placeholder comment when real comments can\'t be loaded.',
          createdAt: new Date(),
        }
      ];
      
      setComments(prev => ({ 
        ...prev, 
        [postId]: mockComments
      }));
    }
  };

  const toggleComments = async (postId: string) => {
    if (!showComments[postId]) {
      await fetchComments(postId);
    }
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleTogglePostsVisibility = async () => {
    if (!user) return;
    
    const newVisibility = postsVisibility === 'public' ? 'private' : 'public';
    setPostsVisibility(newVisibility);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'settings.postsVisibility': newVisibility
      });
    } catch (error) {
      console.error('Error updating posts visibility:', error);
      // Revert on error
      setPostsVisibility(postsVisibility);
    }
  };

  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 pt-16 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        {/* Profile Header */}
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Profile</h1>
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <button 
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="text-primary-600 dark:text-primary-400"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              ) : (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-gray-700 dark:text-gray-300 p-2"
                >
                  <FaEdit className="h-5 w-5" />
                </button>
              )}
              
              <button 
                onClick={() => router.push('/settings')}
                className="text-gray-700 dark:text-gray-300 p-2"
                aria-label="Settings"
              >
                <FaCog className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center mb-4">
            <div className="relative mr-4">
              {userData?.photoURL ? (
                <img
                  src={userData.photoURL} 
                  alt={userData.displayName || 'User'} 
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <FaUser className="h-10 w-10 text-primary-600 dark:text-primary-400" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white mb-2"
                  placeholder="Your name"
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {userData?.displayName || user?.displayName || 'Your Profile'}
                </h2>
              )}
            </div>
          </div>
          
          {/* Bio */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bio</h3>
            {isEditing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
                placeholder="Write a short bio about yourself..."
                rows={3}
              />
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                {userData?.bio || 'No bio yet'}
              </p>
            )}
          </div>
          
          {/* Stats Card */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-light-100 dark:bg-dark-100 rounded-lg">
                <p className="text-2xl font-bold text-primary-600">{totalPostsCount}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Posts</p>
              </div>
              <div className="text-center p-3 bg-light-100 dark:bg-dark-100 rounded-lg">
                <p className="text-2xl font-bold text-primary-600">{friendCount}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Friends</p>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Posts</h2>
            
            {/* Tab Navigation */}
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('posts')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activeTab === 'posts'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-300 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-400'
                }`}
              >
                Posts
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activeTab === 'analytics'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-300 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-400'
                }`}
              >
                Analytics
              </button>
            </div>
          </div>

          {/* Posts Tab Content */}
          {activeTab === 'posts' && (
            <>
              {posts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                    <FaMusic className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Share your first song to start building your music story.
                  </p>
                  <button
                    onClick={() => router.push('/post-song')}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Post a Song
                  </button>
                </div>
              ) : (
                <>
                  {/* Gallery Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className="aspect-square bg-gray-700 rounded-lg overflow-hidden relative group cursor-pointer"
                        onClick={() => setSelectedPost(selectedPost === post.id ? null : post.id)}
                      >
                        <ClickableAlbumCover
                          coverArtUrl={post.songAlbumArt}
                          previewUrl={post.previewUrl}
                          songTitle={post.songTitle}
                          songArtist={post.songArtist}
                          size="large"
                          className="w-full h-full"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <div className="text-white text-center">
                            <p className="text-xs font-medium truncate px-2">{post.songTitle}</p>
                            <p className="text-xs text-gray-300 truncate px-2">{post.songArtist}</p>
                            <p className="text-xs text-gray-300 px-2 mt-1">{formatPostDate(post.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Analytics Tab Content */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <WeeklyInsights />
            </div>
          )}
        </div>

        {/* Logout Button */}
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
          <button
            onClick={handleLogout}
            className="w-full py-3 flex items-center justify-center text-red-600 dark:text-red-400 bg-white dark:bg-dark-200 rounded-lg shadow-md border border-gray-200 dark:border-dark-300"
          >
            <FaSignOutAlt className="mr-2" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && posts.find(p => p.id === selectedPost) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-200 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {(() => {
              const post = posts.find(p => p.id === selectedPost)!;
              return (
                <div className="p-6">
                  {/* Close button */}
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setSelectedPost(null)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Post content */}
                  <div className="flex gap-4 mb-4">
                    <ClickableAlbumCover
                      coverArtUrl={post.songAlbumArt}
                      previewUrl={post.previewUrl}
                      songTitle={post.songTitle}
                      songArtist={post.songArtist}
                      size="large"
                    />
                    <div className="flex-1">
                      <h3 className="text-gray-900 dark:text-white font-semibold text-lg">
                        {post.songTitle}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        {post.songArtist}
                      </p>
                      <p className="text-primary-600 dark:text-primary-400 text-sm mt-1">
                        {post.mood}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatPostDate(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {post.caption && (
                    <p className="text-gray-700 dark:text-gray-300 mb-4">{post.caption}</p>
                  )}

                  {/* Photo carousel if multiple photos exist, or single photo */}
                  {(post.mediaUrls && post.mediaUrls.length > 0) ? (
                    <div className="mb-4 rounded-lg overflow-hidden h-40">
                      <PhotoCarousel
                        mediaUrls={post.mediaUrls}
                        className="w-full h-full rounded-lg"
                        showCounter={true}
                        counterPosition="top-right"
                        showNavigation={true}
                      />
                    </div>
                  ) : post.mediaUrl ? (
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <img
                        src={post.mediaUrl}
                        alt="Attached media"
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    </div>
                  ) : null}

                  <div className="flex items-center gap-6 mb-4">
                    <button
                      onClick={() => handleLikePost(post.id)}
                      className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      {post.likedBy?.includes(user.uid) ? (
                        <FaHeart className="text-red-500" />
                      ) : (
                        <FaRegHeart className="text-gray-500 dark:text-gray-400" />
                      )}
                      <span>{String(post.likes || 0)}</span>
                    </button>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <FaComment />
                      <span>{String(post.comments || 0)}</span>
                    </button>
                  </div>

                  {showComments[post.id] && (
                    <div className="space-y-4">
                      {comments[post.id]?.length > 0 ? (
                        comments[post.id].map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
                              {comment.userPhotoURL ? (
                                <img
                                  src={comment.userPhotoURL}
                                  alt={comment.userDisplayName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                                  <FaUser className="h-3 w-3 text-primary-600 dark:text-primary-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="bg-gray-100 dark:bg-dark-300 rounded-lg p-3">
                                <p className="text-gray-900 dark:text-white font-semibold text-sm">
                                  {comment.userDisplayName}
                                </p>
                                <p className="text-gray-700 dark:text-gray-300 text-sm">
                                  {comment.content}
                                </p>
                              </div>
                              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                {formatPostDate(comment.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No comments yet</p>
                      )}

                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName || 'You'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                              <FaUser className="h-3 w-3 text-primary-600 dark:text-primary-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddComment(post.id);
                              }
                            }}
                            placeholder="Add a comment..."
                            className="flex-1 bg-gray-100 dark:bg-dark-300 text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={!newComment.trim()}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile; 