import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  onSnapshot,
  addDoc,
  Timestamp,
  deleteDoc,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { getLastResetTime, getPacificTime } from './timeUtils';
import { getUserPosts } from './posts';
import { getUserFriends } from './friends';

export interface Match {
  id: string;
  userIds: string[];
  users: {
    [userId: string]: {
      displayName: string;
      photoURL?: string;
      bio?: string;
    };
  };
  createdAt: Date;
  lastMessage?: Date;
  isActive: boolean;
}

export interface MatchedUserPost {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
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
  matchId: string;
  matchedAt: Date;
  mediaUrl?: string;
  mediaUrls?: string[];
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Timestamp;
  isRead: boolean;
}

/**
 * Get all matches for a user (matches persist indefinitely)
 * BACKWARD COMPATIBLE with existing match documents
 * EXCLUDES users who are already friends
 */
export const getUserMatches = async (userId: string): Promise<Match[]> => {
  try {
    // Get user's current friends first
    const userFriends = await getUserFriends(userId);
    const friendIds = new Set(userFriends.map(friend => friend.id));
    
    // First try the new format with isActive filter
    let matchesQuery = query(
      collection(db, 'matches'),
      where('userIds', 'array-contains', userId),
      where('isActive', '==', true)
    );

    let snapshot = await getDocs(matchesQuery);
    
    // If no matches found with isActive filter, try without it (for old matches)
    if (snapshot.empty) {
      matchesQuery = query(
        collection(db, 'matches'),
        where('userIds', 'array-contains', userId)
      );
      snapshot = await getDocs(matchesQuery);
    }

    const matches: Match[] = [];

    for (const matchDoc of snapshot.docs) {
      const matchData = matchDoc.data();
      
      // Skip if explicitly marked as inactive
      if (matchData.isActive === false) {
        continue;
      }
      
      // Find the other user in this match
      const otherUserId = matchData.userIds.find((id: string) => id !== userId);
      
      // Skip if the other user is already a friend
      if (otherUserId && friendIds.has(otherUserId)) {
        console.log(`Skipping match with ${otherUserId} - already friends`);
        continue;
      }
      
      // Get user details for all users in the match
      const users: { [userId: string]: any } = {};
      for (const matchUserId of matchData.userIds) {
        const userDoc = await getDoc(doc(db, 'users', matchUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          users[matchUserId] = {
            displayName: userData.displayName || 'User',
            photoURL: userData.photoURL,
            bio: userData.bio
          };
        }
      }

      matches.push({
        id: matchDoc.id,
        userIds: matchData.userIds,
        users,
        createdAt: matchData.createdAt?.toDate() || new Date(),
        lastMessage: (() => {
          // Safely handle lastMessage conversion
          if (!matchData.lastMessage && !matchData.lastMessageAt) return undefined;
          
          const lastMsg = matchData.lastMessage || matchData.lastMessageAt;
          
          // If it's already a Date object, return it
          if (lastMsg instanceof Date) return lastMsg;
          
          // If it's a Firestore Timestamp, convert it
          if (lastMsg && typeof lastMsg.toDate === 'function') {
            return lastMsg.toDate();
          }
          
          // If it's a string or other format, try to create a Date
          if (lastMsg) {
            try {
              return new Date(lastMsg);
            } catch (e) {
              console.warn('Could not convert lastMessage to Date:', lastMsg);
              return undefined;
            }
          }
          
          return undefined;
        })(),
        isActive: matchData.isActive !== false // Default to true if not specified
      });
    }

    // Sort by last message or creation date
    matches.sort((a, b) => {
      const aTime = a.lastMessage || a.createdAt;
      const bTime = b.lastMessage || b.createdAt;
      return bTime.getTime() - aTime.getTime();
    });

    console.log(`Found ${matches.length} matches (excluding ${friendIds.size} friends)`);
    return matches;
  } catch (error) {
    console.error('Error fetching user matches:', error);
    return [];
  }
};

/**
 * Get current posts from matched users (only active posts within 24-hour window)
 */
export const getMatchedUsersPosts = async (userId: string): Promise<MatchedUserPost[]> => {
  try {
    // First get all user's matches
    const matches = await getUserMatches(userId);
    
    if (matches.length === 0) {
      return [];
    }

    const matchedPosts: MatchedUserPost[] = [];
    const lastReset = getLastResetTime();

    // For each match, get the matched user's current active posts
    for (const match of matches) {
      const otherUserId = match.userIds.find(id => id !== userId);
      
      if (!otherUserId) continue;

      // Get active posts from this matched user
      const userPosts = await getUserPosts(otherUserId);
      
      // Convert to MatchedUserPost format
      for (const post of userPosts) {
        const userData = match.users[otherUserId];
        
        matchedPosts.push({
          id: post.id || '',
          userId: post.userId,
          userDisplayName: userData?.displayName || 'Matched User',
          userPhotoURL: userData?.photoURL,
          songTitle: post.songTitle,
          songArtist: post.songArtist,
          songAlbumArt: post.songAlbumArt,
          spotifyId: post.spotifyId,
          previewUrl: post.previewUrl,
          mood: post.mood,
          caption: post.caption,
          likes: post.likes,
          comments: post.comments,
          createdAt: post.createdAt && typeof (post.createdAt as any).toDate === 'function' 
            ? (post.createdAt as any).toDate() 
            : post.createdAt instanceof Date 
              ? post.createdAt 
              : new Date(post.createdAt),
          matchId: match.id,
          matchedAt: match.createdAt,
          mediaUrl: post.mediaUrl,
          mediaUrls: post.mediaUrls
        });
      }
    }

    // Sort by most recent posts first
    matchedPosts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return matchedPosts;
  } catch (error) {
    console.error('Error fetching matched users posts:', error);
    return [];
  }
};

/**
 * Check if two users are matched
 */
export const areUsersMatched = async (userId1: string, userId2: string): Promise<boolean> => {
  try {
    const matchesQuery = query(
      collection(db, 'matches'),
      where('userIds', 'array-contains', userId1),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(matchesQuery);
    
    return snapshot.docs.some(doc => {
      const matchData = doc.data();
      return matchData.userIds.includes(userId2);
    });
  } catch (error) {
    console.error('Error checking if users are matched:', error);
    return false;
  }
};

/**
 * Create a new match between two users
 */
export const createMatch = async (userId1: string, userId2: string): Promise<string> => {
  try {
    // Check if match already exists
    const existingMatch = await areUsersMatched(userId1, userId2);
    if (existingMatch) {
      throw new Error('Match already exists between these users');
    }

    // Get user data for both users
    const user1Doc = await getDoc(doc(db, 'users', userId1));
    const user2Doc = await getDoc(doc(db, 'users', userId2));

    if (!user1Doc.exists() || !user2Doc.exists()) {
      throw new Error('One or both users not found');
    }

    const user1Data = user1Doc.data();
    const user2Data = user2Doc.data();

    const matchData = {
      userIds: [userId1, userId2],
      users: {
        [userId1]: {
          displayName: user1Data.displayName || 'User',
          photoURL: user1Data.photoURL,
          bio: user1Data.bio
        },
        [userId2]: {
          displayName: user2Data.displayName || 'User',
          photoURL: user2Data.photoURL,
          bio: user2Data.bio
        }
      },
      createdAt: getPacificTime(),
      lastMessage: getPacificTime(),
      isActive: true
    };

    const matchRef = await addDoc(collection(db, 'matches'), matchData);
    return matchRef.id;
  } catch (error) {
    console.error('Error creating match:', error);
    throw error;
  }
};

/**
 * Get match details by ID
 */
export const getMatchById = async (matchId: string): Promise<Match | null> => {
  try {
    const matchDoc = await getDoc(doc(db, 'matches', matchId));
    
    if (!matchDoc.exists()) {
      return null;
    }

    const matchData = matchDoc.data();
    
    // Get user details for all users in the match
    const users: { [userId: string]: any } = {};
    for (const userId of matchData.userIds) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        users[userId] = {
          displayName: userData.displayName || 'User',
          photoURL: userData.photoURL,
          bio: userData.bio
        };
      }
    }

    return {
      id: matchDoc.id,
      userIds: matchData.userIds,
      users,
      createdAt: matchData.createdAt?.toDate() || new Date(),
      lastMessage: (() => {
        // Safely handle lastMessage conversion
        if (!matchData.lastMessage && !matchData.lastMessageAt) return undefined;
        
        const lastMsg = matchData.lastMessage || matchData.lastMessageAt;
        
        // If it's already a Date object, return it
        if (lastMsg instanceof Date) return lastMsg;
        
        // If it's a Firestore Timestamp, convert it
        if (lastMsg && typeof lastMsg.toDate === 'function') {
          return lastMsg.toDate();
        }
        
        // If it's a string or other format, try to create a Date
        if (lastMsg) {
          try {
            return new Date(lastMsg);
          } catch (e) {
            console.warn('Could not convert lastMessage to Date:', lastMsg);
            return undefined;
          }
        }
        
        return undefined;
      })(),
      isActive: matchData.isActive
    };
  } catch (error) {
    console.error('Error fetching match by ID:', error);
    return null;
  }
};

/**
 * Get match statistics for a user
 */
export const getMatchStats = async (userId: string): Promise<{
  totalMatches: number;
  activeMatches: number;
  recentMatches: number;
}> => {
  try {
    const matches = await getUserMatches(userId);
    const now = getPacificTime();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeMatches = matches.filter(match => match.isActive);
    const recentMatches = matches.filter(match => 
      match.createdAt > weekAgo
    );

    return {
      totalMatches: matches.length,
      activeMatches: activeMatches.length,
      recentMatches: recentMatches.length
    };
  } catch (error) {
    console.error('Error fetching match stats:', error);
    return {
      totalMatches: 0,
      activeMatches: 0,
      recentMatches: 0
    };
  }
};

// Get real-time updates for matches
export const subscribeToUserMatches = (
  userId: string, 
  callback: (matches: Match[]) => void
) => {
  const matchesQuery = query(
    collection(db, 'matches'),
    where('userIds', 'array-contains', userId),
    orderBy('lastMessage', 'desc')
  );
  
  return onSnapshot(matchesQuery, (snapshot) => {
    const matches: Match[] = [];
    snapshot.forEach(doc => {
      matches.push({
        id: doc.id,
        ...doc.data()
      } as Match);
    });
    callback(matches);
  });
};

// Get messages for a match
export const getMatchMessages = async (matchId: string): Promise<Message[]> => {
  try {
    const messagesQuery = query(
      collection(db, 'matches', matchId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    
    const messagesSnapshot = await getDocs(messagesQuery);
    const messages: Message[] = [];
    
    messagesSnapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data()
      } as Message);
    });
    
    return messages;
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

// Get real-time updates for messages
export const subscribeToMatchMessages = (
  matchId: string,
  callback: (messages: Message[]) => void
) => {
  const messagesQuery = query(
    collection(db, 'matches', matchId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages: Message[] = [];
    snapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data()
      } as Message);
    });
    callback(messages);
  });
};

// Send a message
export const sendMessage = async (
  matchId: string,
  userId: string,
  text: string
): Promise<string> => {
  try {
    // Add message
    const messagesRef = collection(db, 'matches', matchId, 'messages');
    const messageRef = await addDoc(messagesRef, {
      text,
      senderId: userId,
      timestamp: serverTimestamp(),
      isRead: false
    });
    
    // Update match with last message
    await updateDoc(doc(db, 'matches', matchId), {
      lastMessage: serverTimestamp()
    });
    
    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Mark all messages as read
export const markMessagesAsRead = async (
  matchId: string,
  userId: string
): Promise<void> => {
  try {
    const messagesQuery = query(
      collection(db, 'matches', matchId, 'messages'),
      where('senderId', '!=', userId),
      where('isRead', '==', false)
    );
    
    const messagesSnapshot = await getDocs(messagesQuery);
    
    // Use batch to update multiple messages
    const batch = writeBatch(db);
    messagesSnapshot.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    
    await batch.commit();
    
    // Update match's last message if needed
    const matchDoc = await getDoc(doc(db, 'matches', matchId));
    const matchData = matchDoc.data();
    
    if (matchData?.lastMessage && !matchData.lastMessage.isRead && matchData.lastMessage.senderId !== userId) {
      await updateDoc(doc(db, 'matches', matchId), {
        'lastMessage.isRead': true
      });
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Delete a match (both users will lose the conversation)
export const deleteMatch = async (matchId: string): Promise<void> => {
  try {
    // First delete all messages
    const messagesQuery = query(collection(db, 'matches', matchId, 'messages'));
    const messagesSnapshot = await getDocs(messagesQuery);
    
    const batch = writeBatch(db);
    messagesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Then delete the match
    await deleteDoc(doc(db, 'matches', matchId));
  } catch (error) {
    console.error('Error deleting match:', error);
    throw error;
  }
};

/**
 * Migration function to update existing match documents
 * Call this once to update old matches to new format
 */
export const migrateExistingMatches = async (): Promise<void> => {
  try {
    console.log('Starting match migration...');
    
    const allMatchesQuery = query(collection(db, 'matches'));
    const snapshot = await getDocs(allMatchesQuery);
    
    const batch = writeBatch(db);
    let updatedCount = 0;
    
    snapshot.forEach((matchDoc) => {
      const matchData = matchDoc.data();
      
      // Check if match needs migration
      const needsMigration = (
        matchData.isActive === undefined || 
        (!matchData.lastMessage && !matchData.lastMessageAt)
      );
      
      if (needsMigration) {
        const updates: any = {};
        
        // Add isActive field if missing
        if (matchData.isActive === undefined) {
          updates.isActive = true;
        }
        
        // Add lastMessage field if missing
        if (!matchData.lastMessage && !matchData.lastMessageAt) {
          updates.lastMessage = matchData.createdAt || new Date();
        } else if (matchData.lastMessageAt && !matchData.lastMessage) {
          updates.lastMessage = matchData.lastMessageAt;
        }
        
        batch.update(matchDoc.ref, updates);
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Migration complete: Updated ${updatedCount} match documents`);
    } else {
      console.log('No matches needed migration');
    }
    
  } catch (error) {
    console.error('Error migrating matches:', error);
    throw error;
  }
}; 