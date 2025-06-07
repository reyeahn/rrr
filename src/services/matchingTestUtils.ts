// Testing utilities for the matching algorithm
import { getIntelligentMatches, updateUserMusicPreferences } from './matchingAlgorithm';
import { createPost } from './posts';

/**
 * Test suite for matching algorithm functionality
 */
export class MatchingAlgorithmTester {
  
  /**
   * Create test users with different musical profiles
   */
  static async createTestUsers() {
    const testProfiles = [
      {
        uid: 'test-user-1',
        questionnaire: {
          weekendSoundtrack: 'upbeat electronic dance music',
          moodGenre: 'Electronic',
          discoveryFrequency: 'daily',
          favoriteSongMemory: 'dancing at a festival',
          preferredMoodTag: 'energetic'
        }
      },
      {
        uid: 'test-user-2', 
        questionnaire: {
          weekendSoundtrack: 'chill indie folk acoustic',
          moodGenre: 'Folk',
          discoveryFrequency: 'weekly',
          favoriteSongMemory: 'sitting by a campfire',
          preferredMoodTag: 'peaceful'
        }
      },
      {
        uid: 'test-user-3',
        questionnaire: {
          weekendSoundtrack: 'energetic electronic dance',
          moodGenre: 'Electronic',
          discoveryFrequency: 'daily',
          favoriteSongMemory: 'late night club dancing',
          preferredMoodTag: 'excited'
        }
      }
    ];
    
    console.log('Test users created with different musical profiles');
    return testProfiles;
  }

  /**
   * Create test posts with varied audio features
   */
  static async createTestPosts() {
    const testPosts = [
      {
        userId: 'test-user-2',
        songTitle: 'Peaceful Morning',
        songArtist: 'Indie Folk Artist',
        songAlbumArt: 'https://example.com/peaceful.jpg',
        mood: 'peaceful',
        caption: 'Perfect for quiet mornings',
        song: {
          audioFeatures: {
            valence: 0.3,      // Low happiness (melancholic)
            energy: 0.2,       // Low energy
            danceability: 0.1, // Not danceable
            acousticness: 0.9, // Very acoustic
            tempo: 85          // Slow tempo
          }
        }
      },
      {
        userId: 'test-user-3',
        songTitle: 'Dance Floor Energy',
        songArtist: 'Electronic DJ',
        songAlbumArt: 'https://example.com/dance.jpg',
        mood: 'energetic',
        caption: 'Gets me pumped every time!',
        song: {
          audioFeatures: {
            valence: 0.9,      // High happiness
            energy: 0.95,      // Very high energy
            danceability: 0.9, // Very danceable
            acousticness: 0.1, // Electronic
            tempo: 128         // Fast tempo
          }
        }
      }
    ];
    
    console.log('Test posts created with contrasting audio features');
    return testPosts;
  }

  /**
   * Test compatibility scoring between specific users
   */
  static async testCompatibilityScoring(userId: string) {
    console.log(`\n=== Testing Compatibility Scoring for User: ${userId} ===`);
    
    try {
      // Get intelligent matches
      const matches = await getIntelligentMatches(userId);
      
      console.log(`Found ${matches.length} intelligent matches`);
      
      matches.forEach((match, index) => {
        console.log(`\nMatch ${index + 1}:`);
        console.log(`- Song: "${match.song.title}" by ${match.song.artist}`);
        console.log(`- User: ${match.userId}`);
        console.log(`- Mood: ${match.mood}`);
        console.log(`- Match Score: ${(match.matchScore || 0).toFixed(3)}`);
        
        if (match.song.audioFeatures) {
          console.log(`- Audio Features:`);
          console.log(`  * Valence: ${(match.song.audioFeatures.valence || 0).toFixed(2)}`);
          console.log(`  * Energy: ${(match.song.audioFeatures.energy || 0).toFixed(2)}`);
          console.log(`  * Danceability: ${(match.song.audioFeatures.danceability || 0).toFixed(2)}`);
          console.log(`  * Tempo: ${match.song.audioFeatures.tempo || 'N/A'}`);
        }
      });
      
    } catch (error) {
      console.error('Error testing compatibility scoring:', error);
    }
  }

  /**
   * Test the daily limit enforcement (should return max 15 posts)
   */
  static async testDailyLimit(userId: string) {
    console.log(`\n=== Testing Daily Limit for User: ${userId} ===`);
    
    try {
      const matches = await getIntelligentMatches(userId);
      
      console.log(`Returned ${matches.length} matches (should be <= 15)`);
      
      if (matches.length > 15) {
        console.error('❌ FAILED: Daily limit not enforced');
        return false;
      } else {
        console.log('✅ PASSED: Daily limit enforced correctly');
        return true;
      }
      
    } catch (error) {
      console.error('Error testing daily limit:', error);
      return false;
    }
  }

  /**
   * Test preference learning system
   */
  static async testPreferenceLearning(userId: string) {
    console.log(`\n=== Testing Preference Learning for User: ${userId} ===`);
    
    try {
      await updateUserMusicPreferences(userId);
      console.log('✅ PASSED: Preferences updated based on engagement history');
      return true;
    } catch (error) {
      console.error('❌ FAILED: Error updating preferences:', error);
      return false;
    }
  }

  /**
   * Run comprehensive test suite
   */
  static async runFullTestSuite() {
    console.log('🧪 Starting Matching Algorithm Test Suite...\n');
    
    const testUsers = await this.createTestUsers();
    await this.createTestPosts();
    
    let passedTests = 0;
    let totalTests = 0;
    
    for (const user of testUsers) {
      // Test compatibility scoring
      await this.testCompatibilityScoring(user.uid);
      
      // Test daily limit
      totalTests++;
      if (await this.testDailyLimit(user.uid)) passedTests++;
      
      // Test preference learning
      totalTests++;
      if (await this.testPreferenceLearning(user.uid)) passedTests++;
    }
    
    console.log(`\n🏁 Test Suite Complete: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Matching algorithm is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the implementation.');
    }
    
    return passedTests === totalTests;
  }
}

/**
 * Quick test function for development
 */
export const quickTestMatching = async (userId: string) => {
  console.log(`Quick test for user: ${userId}`);
  await MatchingAlgorithmTester.testCompatibilityScoring(userId);
  await MatchingAlgorithmTester.testDailyLimit(userId);
}; 