import { useState, useEffect, useCallback } from 'react';
import { User, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { 
  signUpWithEmail, 
  signInWithEmail, 
  signInWithGoogle, 
  logOut, 
  resetPassword 
} from '../services/auth';
import { hasPostedToday as checkHasPostedToday } from '../services/timeUtils';
import { migrateExistingMatches } from '../services/matches';
import { getPacificTime } from '../services/timeUtils';

export interface UserData {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  createdAt: any;
  lastActive: any;
  bio: string;
  onboardingCompleted: boolean;
  preferences: {
    theme: string;
    notificationsEnabled: boolean;
    privacySettings: {
      postVisibility: string;
      profileVisibility: string;
    };
  };
  questionnaire: {
    weekendSoundtrack: string;
    moodGenre: string;
    discoveryFrequency: string;
    favoriteSongMemory: string;
    preferredMoodTag: string;
  };
  stats: {
    totalPosts: number;
    totalMatches: number;
    totalLikes: number;
    totalComments: number;
  };
  hasPostedToday: boolean;
  spotifyConnected: boolean;
  appleConnected: boolean;
  settings?: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    matchNotifications?: boolean;
    commentNotifications?: boolean;
    profileVisibility?: string;
    showActivity?: boolean;
    postsVisibility?: 'public' | 'private';
  };
}

interface AuthHook {
  user: User | null | undefined;
  userData: UserData | null;
  loading: boolean;
  error: Error | undefined;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  googleSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateUserProfile: (profileData: { displayName?: string | null; photoURL?: string | null }) => Promise<void>;
}

export const useAuth = (): AuthHook => {
  const [user, loading, error] = useAuthState(auth);
  const [userData, setUserData] = useState<UserData | null>(null);

  const fetchUserData = useCallback(async () => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      try {
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          // Calculate hasPostedToday based on Pacific Time logic with fallback
          const calculatedHasPostedToday = checkHasPostedToday(data.lastPostDate, data.lastPostDateManual);
          
          setUserData({ 
            uid: user.uid, 
            ...data,
            hasPostedToday: calculatedHasPostedToday
          } as UserData);

          // Run one-time migration for matches (only once per user)
          if (!data.matchesMigrated) {
            try {
              console.log('Running one-time match migration...');
              await migrateExistingMatches();
              
              // Mark migration as complete for this user
              await setDoc(userDocRef, { 
                ...data,
                matchesMigrated: true 
              }, { merge: true });
              
              console.log('✅ Match migration completed for user');
            } catch (migrationError) {
              console.error('Migration failed, but continuing:', migrationError);
            }
          }
        } else {
          // Create default user document
          const defaultUserData: Omit<UserData, 'uid'> = {
            displayName: user.displayName,
            email: user.email,
            emailVerified: true,
            photoURL: user.photoURL,
            createdAt: getPacificTime(),
            lastActive: getPacificTime(),
            bio: '',
            onboardingCompleted: false,
            preferences: {
              theme: 'dark',
              notificationsEnabled: true,
              privacySettings: {
                postVisibility: 'public',
                profileVisibility: 'public'
              }
            },
            questionnaire: {
              weekendSoundtrack: '',
              moodGenre: '',
              discoveryFrequency: '',
              favoriteSongMemory: '',
              preferredMoodTag: ''
            },
            stats: {
              totalPosts: 0,
              totalMatches: 0,
              totalLikes: 0,
              totalComments: 0
            },
            hasPostedToday: false, // New user hasn't posted
            spotifyConnected: false,
            appleConnected: false
          };
          
          // Set the document in Firestore (with migration flag for new users)
          await setDoc(userDocRef, { 
            ...defaultUserData, 
            matchesMigrated: true 
          });
          
          // Set the user data in state
          setUserData({ uid: user.uid, ...defaultUserData } as UserData);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    } else {
      setUserData(null);
    }
  }, [user]);

  // Initial data fetch when user changes (REMOVED POLLING)
  useEffect(() => {
    if (!loading) {
      fetchUserData();
    }
  }, [user, loading, fetchUserData]);

  // Function to manually refresh user data (only when explicitly needed)
  const refreshUserData = async () => {
    await fetchUserData();
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    await signUpWithEmail(email, password, displayName);
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmail(email, password);
  };

  const googleSignIn = async () => {
    await signInWithGoogle();
  };

  const logout = async () => {
    await logOut();
  };

  const resetUserPassword = async (email: string) => {
    await resetPassword(email);
  };

  const updateUserProfile = async (profileData: { displayName?: string | null; photoURL?: string | null }) => {
    if (!user) {
      throw new Error('No user logged in');
    }
    
    try {
      // Update Firebase Auth profile
      await updateProfile(user, profileData);
      
      // Refresh user data after update
      await fetchUserData();
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };

  return {
    user,
    userData,
    loading,
    error,
    signUp,
    signIn,
    googleSignIn,
    logout,
    resetUserPassword,
    refreshUserData,
    updateUserProfile
  };
}; 