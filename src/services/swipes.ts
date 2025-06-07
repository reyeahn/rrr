import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { createMatch } from './matches';
import { getActivePosts } from './posts';
import { getPacificTime } from './timeUtils';

export interface Swipe {
  id?: string;
  swiperId: string;
  postId: string;
  postUserId: string;
  direction: 'left' | 'right';
  timestamp: Date;
}

/**
 * Record a swipe and check for matches
 */
export const recordSwipe = async (
  swiperId: string,
  postId: string,
  postUserId: string,
  direction: 'left' | 'right'
): Promise<string | null> => {
  try {
    // Record the swipe
    const swipeData: Omit<Swipe, 'id'> = {
      swiperId,
      postId,
      postUserId,
      direction,
      timestamp: getPacificTime()
    };

    await addDoc(collection(db, 'swipes'), swipeData);

    // If it's a right swipe (like), check for a match
    if (direction === 'right') {
      const matchId = await checkForMatch(swiperId, postUserId);
      return matchId;
    }

    return null;
  } catch (error) {
    console.error('Error recording swipe:', error);
    throw error;
  }
};

/**
 * Check if a mutual like creates a match
 */
const checkForMatch = async (swiperId: string, postUserId: string): Promise<string | null> => {
  try {
    // Check if the post user has also liked any of the swiper's posts
    const swiperPostsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', swiperId)
    );
    const swiperPosts = await getDocs(swiperPostsQuery);
    
    if (swiperPosts.empty) {
      return null; // Swiper has no posts to be liked back
    }

    // Check if post user has liked any of swiper's posts
    const swiperPostIds = swiperPosts.docs.map(doc => doc.id);
    
    for (const swiperPostId of swiperPostIds) {
      const mutualSwipeQuery = query(
        collection(db, 'swipes'),
        where('swiperId', '==', postUserId),
        where('postId', '==', swiperPostId),
        where('direction', '==', 'right')
      );
      
      const mutualSwipes = await getDocs(mutualSwipeQuery);
      
      if (!mutualSwipes.empty) {
        // Mutual like found! Create a match
        try {
          const matchId = await createMatch(swiperId, postUserId);
          console.log(`Match created: ${matchId} between ${swiperId} and ${postUserId}`);
          return matchId;
        } catch (matchError) {
          console.error('Error creating match:', matchError);
          // If match already exists, that's okay
          if (matchError instanceof Error && matchError.message.includes('already exists')) {
            return null;
          }
          throw matchError;
        }
      }
    }

    return null; // No mutual like found
  } catch (error) {
    console.error('Error checking for match:', error);
    return null;
  }
};

/**
 * Get posts that haven't been swiped by the user (active posts only)
 * EXCLUDES posts from friends and matched users
 */
export const getUnswiped = async (userId: string): Promise<string[]> => {
  try {
    // Get user's friends list
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userFriends = userDoc.exists() ? (userDoc.data().friends || []) : [];
    
    // Get user's matched users
    const matchesQuery = query(
      collection(db, 'matches'),
      where('userIds', 'array-contains', userId)
    );
    const matchesSnapshot = await getDocs(matchesQuery);
    const matchedUserIds: string[] = [];
    
    matchesSnapshot.forEach(doc => {
      const matchData = doc.data();
      const otherUserId = matchData.userIds.find((id: string) => id !== userId);
      if (otherUserId) {
        matchedUserIds.push(otherUserId);
      }
    });

    // Combine friends and matched users to exclude from discover
    const excludedUserIds = Array.from(new Set(userFriends.concat(matchedUserIds)));
    console.log(`getUnswiped: Excluding ${excludedUserIds.length} users (friends + matches)`);

    // Get all posts the user has swiped on
    const swipesQuery = query(
      collection(db, 'swipes'),
      where('swiperId', '==', userId)
    );
    const swipesSnapshot = await getDocs(swipesQuery);
    const swipedPostIds = swipesSnapshot.docs.map(doc => doc.data().postId);

    // Get all active posts
    const activePosts = await getActivePosts();
    
    // Filter out user's own posts, already swiped posts, and posts from friends/matches
    const unswipedPosts = activePosts.filter(post => 
      post.userId !== userId && 
      post.id && 
      !swipedPostIds.includes(post.id) &&
      !excludedUserIds.includes(post.userId) // EXCLUDE friends and matches
    );

    console.log(`getUnswiped: Found ${unswipedPosts.length} unswiped posts after filtering`);
    return unswipedPosts.map(post => post.id!);
  } catch (error) {
    console.error('Error getting unswiped posts:', error);
    return [];
  }
};

/**
 * Check if user has swiped on a specific post
 */
export const hasUserSwiped = async (userId: string, postId: string): Promise<boolean> => {
  try {
    const swipeQuery = query(
      collection(db, 'swipes'),
      where('swiperId', '==', userId),
      where('postId', '==', postId)
    );
    
    const swipeSnapshot = await getDocs(swipeQuery);
    return !swipeSnapshot.empty;
  } catch (error) {
    console.error('Error checking if user has swiped:', error);
    return false;
  }
};

/**
 * Get user's swipe history (for analytics)
 */
export const getUserSwipeHistory = async (
  userId: string, 
  limit: number = 50
): Promise<Swipe[]> => {
  try {
    const swipesQuery = query(
      collection(db, 'swipes'),
      where('swiperId', '==', userId),
      // orderBy('timestamp', 'desc'), // Enable if you need ordering
      // limit(limit) // Enable if you need limiting
    );
    
    const swipesSnapshot = await getDocs(swipesQuery);
    const swipes: Swipe[] = [];
    
    swipesSnapshot.forEach(doc => {
      swipes.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as Swipe);
    });
    
    // Sort by timestamp descending (most recent first)
    swipes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return swipes.slice(0, limit);
  } catch (error) {
    console.error('Error getting user swipe history:', error);
    return [];
  }
};

/**
 * Get swipe statistics for a user
 */
export const getSwipeStats = async (userId: string): Promise<{
  totalSwipes: number;
  rightSwipes: number;
  leftSwipes: number;
  swipeRatio: number;
}> => {
  try {
    const swipes = await getUserSwipeHistory(userId, 1000); // Get more for accurate stats
    
    const totalSwipes = swipes.length;
    const rightSwipes = swipes.filter(swipe => swipe.direction === 'right').length;
    const leftSwipes = swipes.filter(swipe => swipe.direction === 'left').length;
    const swipeRatio = totalSwipes > 0 ? rightSwipes / totalSwipes : 0;
    
    return {
      totalSwipes,
      rightSwipes,
      leftSwipes,
      swipeRatio
    };
  } catch (error) {
    console.error('Error getting swipe stats:', error);
    return {
      totalSwipes: 0,
      rightSwipes: 0,
      leftSwipes: 0,
      swipeRatio: 0
    };
  }
}; 