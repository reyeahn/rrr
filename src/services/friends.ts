import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { createNotification } from './notifications';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
  fromUserName?: string;
  fromUserPhoto?: string;
}

export interface Friend {
  id: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  lastActive?: Timestamp;
}

// Get all friends for a user
export const getUserFriends = async (userId: string): Promise<Friend[]> => {
  try {
    // Get the user document
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const friendIds = userData.friends || [];
    
    if (friendIds.length === 0) {
      return [];
    }
    
    // Get friend user documents
    const friends: Friend[] = [];
    
    // Using Promise.all to make parallel requests
    const friendPromises = friendIds.map(async (friendId: string) => {
      const friendDoc = await getDoc(doc(db, 'users', friendId));
      
      if (friendDoc.exists()) {
        const friendData = friendDoc.data();
        
        friends.push({
          id: friendDoc.id,
          displayName: friendData.displayName || 'User',
          photoURL: friendData.photoURL,
          bio: friendData.bio,
          lastActive: friendData.lastActive
        });
      }
    });
    
    await Promise.all(friendPromises);
    
    return friends;
  } catch (error) {
    console.error('Error fetching user friends:', error);
    throw error;
  }
};

// Subscribe to real-time updates for a user's friends list
export const subscribeToUserFriends = (
  userId: string,
  callback: (friends: Friend[]) => void
) => {
  // Create a listener for the user document
  const userDocRef = doc(db, 'users', userId);
  
  // This will fire whenever the user document changes
  return onSnapshot(userDocRef, async (snapshot) => {
    if (snapshot.exists()) {
      const userData = snapshot.data();
      const friendIds = userData.friends || [];
      
      if (friendIds.length === 0) {
        callback([]);
        return;
      }
      
      // Get friend user documents
      const friends: Friend[] = [];
      
      // Using Promise.all to make parallel requests
      const friendPromises = friendIds.map(async (friendId: string) => {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        
        if (friendDoc.exists()) {
          const friendData = friendDoc.data();
          
          friends.push({
            id: friendDoc.id,
            displayName: friendData.displayName || 'User',
            photoURL: friendData.photoURL,
            bio: friendData.bio,
            lastActive: friendData.lastActive
          });
        }
      });
      
      await Promise.all(friendPromises);
      
      callback(friends);
    } else {
      callback([]);
    }
  });
};

// Send a friend request
export const sendFriendRequest = async (
  fromUserId: string, 
  toUserId: string,
  fromUserName: string
): Promise<string> => {
  try {
    // Check if request already exists
    const existingRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending')
    );
    
    const existingRequests = await getDocs(existingRequestsQuery);
    
    if (!existingRequests.empty) {
      // Request already exists, return the ID
      return existingRequests.docs[0].id;
    }
    
    // Create new friend request
    const requestRef = await addDoc(collection(db, 'friendRequests'), {
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    
    // Get the sender's photo URL
    const fromUserDoc = await getDoc(doc(db, 'users', fromUserId));
    const fromUserPhotoURL = fromUserDoc.exists() ? fromUserDoc.data()?.photoURL : null;
    
    // Create a notification for the recipient
    await createNotification(
      toUserId,
      'friend_request',
      fromUserId,
      fromUserName,
      fromUserPhotoURL,
      `${fromUserName} sent you a friend request`,
      requestRef.id
    );
    
    return requestRef.id;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

// Get pending friend requests for a user
export const getPendingFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
  try {
    const requestsQuery = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const requestsSnapshot = await getDocs(requestsQuery);
    const requests: FriendRequest[] = [];
    
    // Using Promise.all to make parallel requests
    const requestPromises = requestsSnapshot.docs.map(async (docSnapshot) => {
      const requestData = docSnapshot.data();
      
      // Get the sender's user information
      const senderDoc = await getDoc(doc(db, 'users', requestData.fromUserId));
      const senderData = senderDoc.exists() ? senderDoc.data() : null;
      
      requests.push({
        id: docSnapshot.id,
        fromUserId: requestData.fromUserId,
        toUserId: requestData.toUserId,
        status: requestData.status,
        createdAt: requestData.createdAt,
        fromUserName: senderData?.displayName || 'User',
        fromUserPhoto: senderData?.photoURL
      });
    });
    
    await Promise.all(requestPromises);
    
    return requests;
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    throw error;
  }
};

// Accept a friend request
export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  try {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists()) {
      throw new Error('Friend request not found');
    }
    
    const requestData = requestDoc.data();
    
    if (requestData.status !== 'pending') {
      throw new Error('Friend request is not pending');
    }
    
    const fromUserId = requestData.fromUserId;
    const toUserId = requestData.toUserId;
    
    // Update friend request status
    await updateDoc(requestRef, {
      status: 'accepted'
    });
    
    // Add each user to the other's friends list
    const fromUserRef = doc(db, 'users', fromUserId);
    const toUserRef = doc(db, 'users', toUserId);
    
    // Get user data to create notifications
    const fromUserDoc = await getDoc(fromUserRef);
    const toUserDoc = await getDoc(toUserRef);
    
    const fromUserName = fromUserDoc.data()?.displayName || 'User';
    const toUserName = toUserDoc.data()?.displayName || 'User';
    const fromUserPhotoURL = fromUserDoc.data()?.photoURL || null;
    const toUserPhotoURL = toUserDoc.data()?.photoURL || null;
    
    // Update both users' friends lists
    await updateDoc(fromUserRef, {
      friends: arrayUnion(toUserId)
    });
    
    await updateDoc(toUserRef, {
      friends: arrayUnion(fromUserId)
    });
    
    // Create notifications for both users
    await createNotification(
      fromUserId,
      'friend_request_accepted',
      toUserId,
      toUserName,
      toUserPhotoURL,
      `${toUserName} accepted your friend request`,
      undefined
    );
    
    await createNotification(
      toUserId,
      'friend_added',
      fromUserId,
      fromUserName,
      fromUserPhotoURL,
      `You are now friends with ${fromUserName}`,
      undefined
    );
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

// Reject a friend request
export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  try {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists()) {
      throw new Error('Friend request not found');
    }
    
    const requestData = requestDoc.data();
    
    if (requestData.status !== 'pending') {
      throw new Error('Friend request is not pending');
    }
    
    // Update friend request status
    await updateDoc(requestRef, {
      status: 'rejected'
    });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
};

// Remove a friend
export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const friendRef = doc(db, 'users', friendId);
    
    // Remove each user from the other's friends list
    await updateDoc(userRef, {
      friends: arrayRemove(friendId)
    });
    
    await updateDoc(friendRef, {
      friends: arrayRemove(userId)
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

// Find users by username or email
export const findUsers = async (searchQuery: string, currentUserId: string): Promise<Friend[]> => {
  try {
    // First check if the query is an email
    const isEmail = searchQuery.includes('@');
    
    // Get users matching the query
    const usersQuery = isEmail 
      ? query(collection(db, 'users'), where('email', '==', searchQuery))
      : query(collection(db, 'users'), where('displayName', '>=', searchQuery), where('displayName', '<=', searchQuery + '\uf8ff'));
    
    const usersSnapshot = await getDocs(usersQuery);
    const users: Friend[] = [];
    
    usersSnapshot.forEach(doc => {
      // Don't include the current user in the results
      if (doc.id !== currentUserId) {
        const userData = doc.data();
        
        users.push({
          id: doc.id,
          displayName: userData.displayName || 'User',
          photoURL: userData.photoURL,
          bio: userData.bio
        });
      }
    });
    
    return users;
  } catch (error) {
    console.error('Error finding users:', error);
    throw error;
  }
}; 