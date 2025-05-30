import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '@/services/firebase';

// OpenAI Integration for Enhanced Analytics
interface OpenAIAnalysisRequest {
  userData: {
    posts: any[];
    engagement: any;
    musicPreferences: any;
    questionnaire: any;
  };
  timeframe: string;
}

interface OpenAIInsights {
  personalizedInsights: string[];
  musicTasteAnalysis: string;
  moodPatternAnalysis: string;
  engagementAdvice: string[];
  weeklyHighlights: string[];
}

export interface MoodAnalysis {
  mood: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface EngagementMetrics {
  postsLiked: number;
  postsShared: number;
  commentsGiven: number;
  matchesReceived: number;
  avgEngagementScore: number;
}

export interface MusicPreferenceInsights {
  topGenres: { genre: string; count: number }[];
  avgAudioFeatures: {
    valence: number;    // happiness level
    energy: number;     // energy level
    danceability: number;
    tempo: number;
  };
  moodProgression: {
    date: string;
    averageMood: number; // 0-1 scale
    dominantMood: string;
  }[];
}

export interface WeeklyReport {
  weekStart: Date;
  weekEnd: Date;
  userId: string;
  moodAnalysis: MoodAnalysis[];
  engagementMetrics: EngagementMetrics;
  musicInsights: MusicPreferenceInsights;
  insights: string[];
  recommendations: string[];
  aiGeneratedInsights?: OpenAIInsights; // Enhanced AI insights
  generatedAt: Date;
}

/**
 * Generate enhanced insights using OpenAI API
 */
const generateOpenAIInsights = async (analysisData: OpenAIAnalysisRequest): Promise<OpenAIInsights | null> => {
  try {
    // Prepare the prompt for OpenAI
    const prompt = `
You are a music psychology expert analyzing a user's weekly music engagement data. 
Please provide personalized insights based on this data:

USER DATA:
Posts: ${JSON.stringify(analysisData.userData.posts.map(p => ({ 
  mood: p.mood, 
  songTitle: p.songTitle, 
  songArtist: p.songArtist, 
  audioFeatures: p.song?.audioFeatures,
  caption: p.caption 
})))}

Engagement: Liked ${analysisData.userData.engagement.likes?.length || 0} posts, 
Made ${analysisData.userData.engagement.comments?.length || 0} comments, 
Got ${analysisData.userData.engagement.matches?.length || 0} matches

Music Preferences: ${JSON.stringify(analysisData.userData.musicPreferences)}

Questionnaire Responses: ${JSON.stringify(analysisData.userData.questionnaire)}

Timeframe: ${analysisData.timeframe}

Please provide:
1. 3-5 personalized insights about their music behavior and psychology
2. A detailed music taste analysis (2-3 sentences)
3. A mood pattern analysis based on their posts (2-3 sentences) 
4. 3-4 specific actionable engagement tips
5. 2-3 weekly highlights or achievements

Format as JSON with fields: personalizedInsights, musicTasteAnalysis, moodPatternAnalysis, engagementAdvice, weeklyHighlights
Keep insights personal, encouraging, and music-focused. Be specific about their patterns.
`;

    const response = await fetch('/api/openai-insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      console.warn('OpenAI API request failed, falling back to rule-based insights');
      return null;
    }

    const data = await response.json();
    return data.insights as OpenAIInsights;
  } catch (error) {
    console.error('Error calling OpenAI for insights:', error);
    return null;
  }
};

/**
 * Generate comprehensive weekly analytics for a user with AI enhancement
 * Can generate reports for any week, supporting historical analysis from the 1st of each month
 */
export const generateWeeklyAnalytics = async (userId: string, weekStart?: Date): Promise<WeeklyReport> => {
  const startDate = weekStart || getWeekStart();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);
  endDate.setHours(23, 59, 59, 999); // End of day

  console.log(`Generating analytics for ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  try {
    // Fetch user's posts for the specific week with time boundaries
    const userPosts = await getUserWeeklyPosts(userId, startDate, endDate);
    console.log(`Found ${userPosts.length} posts for the week`);
    
    // Fetch user's engagement activities for the specific week
    const userEngagement = await getUserWeeklyEngagement(userId, startDate, endDate);
    console.log(`Found engagement: ${userEngagement.likes?.length || 0} likes, ${userEngagement.comments?.length || 0} comments, ${userEngagement.matches?.length || 0} matches`);
    
    // Get user profile for AI analysis
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userProfile = userDoc.exists() ? userDoc.data() : {};
    
    // Analyze mood patterns
    const moodAnalysis = analyzeMoodPatterns(userPosts, userEngagement);
    
    // Calculate engagement metrics
    const engagementMetrics = calculateEngagementMetrics(userEngagement);
    
    // Generate music preference insights
    const musicInsights = await generateMusicInsights(userId, userPosts, userEngagement);
    
    // Try to get AI-enhanced insights
    let aiGeneratedInsights: OpenAIInsights | null = null;
    try {
      const openAIResult = await generateOpenAIInsights({
        userData: {
          posts: userPosts,
          engagement: userEngagement,
          musicPreferences: userProfile.musicPreferences || {},
          questionnaire: userProfile.questionnaire || {}
        },
        timeframe: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
      });
      
      if (openAIResult) {
        aiGeneratedInsights = openAIResult;
        console.log('✅ AI insights generated successfully');
      }
    } catch (aiError) {
      console.warn('AI insights generation failed, using fallback:', aiError);
      aiGeneratedInsights = null;
    }
    
    // Generate fallback insights and recommendations (enhanced by AI if available)
    const insights = aiGeneratedInsights?.personalizedInsights || 
                    generateInsights(moodAnalysis, engagementMetrics, musicInsights, startDate, endDate);
    
    const recommendations = aiGeneratedInsights?.engagementAdvice || 
                          generateRecommendations(moodAnalysis, engagementMetrics, musicInsights, startDate, endDate);

    const report: WeeklyReport = {
      weekStart: startDate,
      weekEnd: endDate,
      userId,
      moodAnalysis,
      engagementMetrics,
      musicInsights,
      insights,
      recommendations,
      generatedAt: new Date()
    };

    // Only include aiGeneratedInsights if it's not null
    if (aiGeneratedInsights) {
      report.aiGeneratedInsights = aiGeneratedInsights;
    }

    // Save the report to Firestore
    await saveWeeklyReport(userId, report);
    
    console.log('✅ Weekly analytics generated and saved successfully');
    return report;
  } catch (error) {
    console.error('Error generating weekly analytics:', error);
    throw error;
  }
};

/**
 * Get the start of the current week (Monday)
 */
const getWeekStart = (): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday = 0
  return new Date(now.setDate(diff));
};

/**
 * Fetch user's posts for a specific week
 */
const getUserWeeklyPosts = async (userId: string, startDate: Date, endDate: Date) => {
  const postsQuery = query(
    collection(db, 'posts'),
    where('userId', '==', userId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(postsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate()
  }));
};

/**
 * Fetch user's engagement activities for a specific week
 */
const getUserWeeklyEngagement = async (userId: string, startDate: Date, endDate: Date) => {
  // Get likes (swipes right)
  const likesQuery = query(
    collection(db, 'swipes'),
    where('swiperId', '==', userId),
    where('direction', '==', 'right'),
    where('timestamp', '>=', Timestamp.fromDate(startDate)),
    where('timestamp', '<=', Timestamp.fromDate(endDate))
  );

  // Get comments
  const commentsQuery = query(
    collection(db, 'comments'),
    where('userId', '==', userId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate))
  );

  // Get matches
  const matchesQuery = query(
    collection(db, 'matches'),
    where('userIds', 'array-contains', userId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate))
  );

  const [likesSnapshot, commentsSnapshot, matchesSnapshot] = await Promise.all([
    getDocs(likesQuery),
    getDocs(commentsQuery),
    getDocs(matchesQuery)
  ]);

  return {
    likes: likesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    comments: commentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    matches: matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  };
};

/**
 * Analyze mood patterns from posts and engagement
 */
const analyzeMoodPatterns = (posts: any[], engagement: any): MoodAnalysis[] => {
  const moodCounts: { [key: string]: number } = {};
  
  // Count moods from posts
  posts.forEach(post => {
    const mood = post.mood || 'Unknown';
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
  });

  // Count moods from liked posts (if available in engagement data)
  // This would require fetching the posts that were liked
  
  const totalPosts = posts.length;
  const moodAnalysis: MoodAnalysis[] = [];

  Object.entries(moodCounts).forEach(([mood, count]) => {
    moodAnalysis.push({
      mood,
      count,
      percentage: totalPosts > 0 ? (count / totalPosts) * 100 : 0,
      trend: 'stable' // This would need historical comparison
    });
  });

  return moodAnalysis.sort((a, b) => b.count - a.count);
};

/**
 * Calculate engagement metrics
 */
const calculateEngagementMetrics = (engagement: any): EngagementMetrics => {
  return {
    postsLiked: engagement.likes?.length || 0,
    postsShared: 0, // Not implemented yet
    commentsGiven: engagement.comments?.length || 0,
    matchesReceived: engagement.matches?.length || 0,
    avgEngagementScore: calculateEngagementScore(engagement)
  };
};

/**
 * Calculate overall engagement score (0-100)
 */
const calculateEngagementScore = (engagement: any): number => {
  const likes = engagement.likes?.length || 0;
  const comments = engagement.comments?.length || 0;
  const matches = engagement.matches?.length || 0;

  // Weight different engagement types
  const score = (likes * 1) + (comments * 3) + (matches * 10);
  
  // Normalize to 0-100 scale (adjust as needed)
  return Math.min(100, score);
};

/**
 * Generate music preference insights
 */
const generateMusicInsights = async (userId: string, posts: any[], engagement: any): Promise<MusicPreferenceInsights> => {
  const genres: string[] = [];
  const audioFeatures: any[] = [];
  const moodProgression: any[] = [];

  // Analyze user's own posts
  posts.forEach(post => {
    if (post.song?.genres) {
      genres.push(...post.song.genres);
    }
    if (post.song?.audioFeatures) {
      audioFeatures.push(post.song.audioFeatures);
    }
    
    // Track mood progression
    moodProgression.push({
      date: post.createdAt?.toISOString().split('T')[0],
      mood: post.mood,
      valence: post.song?.audioFeatures?.valence || 0.5
    });
  });

  // Count genre preferences
  const genreCounts: { [key: string]: number } = {};
  genres.forEach(genre => {
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  });

  const topGenres = Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate average audio features
  let avgAudioFeatures = {
    valence: 0.5,
    energy: 0.5,
    danceability: 0.5,
    tempo: 120
  };

  if (audioFeatures.length > 0) {
    const sums = audioFeatures.reduce((acc, feature) => ({
      valence: acc.valence + (feature.valence || 0),
      energy: acc.energy + (feature.energy || 0),
      danceability: acc.danceability + (feature.danceability || 0),
      tempo: acc.tempo + (feature.tempo || 0)
    }), { valence: 0, energy: 0, danceability: 0, tempo: 0 });

    avgAudioFeatures = {
      valence: sums.valence / audioFeatures.length,
      energy: sums.energy / audioFeatures.length,
      danceability: sums.danceability / audioFeatures.length,
      tempo: sums.tempo / audioFeatures.length
    };
  }

  return {
    topGenres,
    avgAudioFeatures,
    moodProgression: moodProgression.map(item => ({
      date: item.date,
      averageMood: item.valence,
      dominantMood: item.mood
    }))
  };
};

/**
 * Generate time-relevant AI-powered insights
 */
const generateInsights = (
  moodAnalysis: MoodAnalysis[], 
  engagement: EngagementMetrics, 
  musicInsights: MusicPreferenceInsights,
  startDate: Date,
  endDate: Date
): string[] => {
  const insights: string[] = [];

  // Get time period context
  const weekNumber = getWeekNumber(startDate);
  const month = startDate.toLocaleDateString('en-US', { month: 'long' });
  const isCurrentWeek = isDateInCurrentWeek(startDate);
  const timeContext = isCurrentWeek ? 'this week' : `the week of ${startDate.toLocaleDateString()}`;

  // Mood insights with time context
  if (moodAnalysis.length > 0) {
    const topMood = moodAnalysis[0];
    insights.push(`During ${timeContext}, your dominant mood was ${topMood.mood.toLowerCase()}, appearing in ${topMood.percentage.toFixed(1)}% of your posts.`);
    
    // Add seasonal context if not current week
    if (!isCurrentWeek) {
      insights.push(`Looking back at ${month}, you were exploring ${topMood.mood.toLowerCase()} music during this period.`);
    }
  }

  // Engagement insights with temporal context
  if (engagement.postsLiked > 10) {
    insights.push(`You were very active during ${timeContext}, liking ${engagement.postsLiked} posts. ${isCurrentWeek ? "You're engaging well with the community!" : "You had strong engagement during this period!"}`);
  } else if (engagement.postsLiked < 3) {
    insights.push(`${isCurrentWeek ? "You liked fewer posts this week." : `You had lighter engagement during ${timeContext}.`} Consider exploring more music to discover new favorites!`);
  }

  // Music insights with time relevance
  if (musicInsights.avgAudioFeatures.valence > 0.7) {
    insights.push(`Your music choices during ${timeContext} were very upbeat and positive, with high happiness levels. ${isCurrentWeek ? "Great for maintaining good vibes!" : "This was a particularly bright period in your music journey!"}`);
  } else if (musicInsights.avgAudioFeatures.valence < 0.3) {
    insights.push(`Your music during ${timeContext} had a more introspective, melancholic tone. ${isCurrentWeek ? "Sometimes we need those reflective moments." : "This period shows a more contemplative side of your musical taste."}`);
  }

  if (musicInsights.avgAudioFeatures.energy > 0.8) {
    insights.push(`You gravitated toward high-energy tracks during ${timeContext} - ${isCurrentWeek ? "perfect for staying motivated!" : "a high-energy period in your listening history!"}`);
  }

  // Match insights with time context
  if (engagement.matchesReceived > 0) {
    insights.push(`You made ${engagement.matchesReceived} new connection${engagement.matchesReceived === 1 ? '' : 's'} during ${timeContext} through shared music taste!`);
  }

  // Weekly progression insights for current week
  if (isCurrentWeek && moodAnalysis.length > 1) {
    insights.push(`You've shown good mood diversity this week, expressing ${moodAnalysis.length} different emotional states through music.`);
  }

  return insights;
};

/**
 * Generate time-relevant personalized recommendations
 */
const generateRecommendations = (
  moodAnalysis: MoodAnalysis[], 
  engagement: EngagementMetrics, 
  musicInsights: MusicPreferenceInsights,
  startDate: Date,
  endDate: Date
): string[] => {
  const recommendations: string[] = [];
  const isCurrentWeek = isDateInCurrentWeek(startDate);
  const timeContext = isCurrentWeek ? 'this week' : 'going forward';

  // Engagement recommendations with time awareness
  if (engagement.postsLiked < 5) {
    recommendations.push(`${isCurrentWeek ? "Try exploring more posts in the Discover feed" : "Consider increasing your exploration of"} new music to find songs that resonate with you.`);
  }

  if (engagement.commentsGiven < 2) {
    recommendations.push(`${isCurrentWeek ? "Consider leaving comments on posts you enjoy" : "Try engaging more with the community through comments"} - it's a great way to connect with others!`);
  }

  // Mood diversity recommendations
  if (moodAnalysis.length === 1) {
    recommendations.push(`${isCurrentWeek ? "Try posting songs that represent different moods" : "Consider exploring a wider range of emotional expressions in your music"} to show your full emotional range.`);
  }

  // Music discovery recommendations based on historical patterns
  if (musicInsights.topGenres.length < 3) {
    recommendations.push(`${isCurrentWeek ? "Experiment with different genres" : "Based on your patterns, try exploring new genres"} to expand your musical palette and find new matches.`);
  }

  // Energy-based recommendations with seasonal awareness
  if (musicInsights.avgAudioFeatures.energy < 0.4) {
    const currentMonth = new Date().getMonth();
    const isWinter = currentMonth === 11 || currentMonth === 0 || currentMonth === 1;
    
    if (isCurrentWeek && isWinter) {
      recommendations.push("Consider adding some higher-energy tracks to boost your mood during the winter months.");
    } else {
      recommendations.push("Consider adding some higher-energy tracks to boost your mood and discover new connections.");
    }
  }

  // Weekly goal recommendations for current week
  if (isCurrentWeek) {
    recommendations.push("Set a goal to discover at least 3 new songs this week that match your current mood.");
  }

  return recommendations;
};

/**
 * Check if a date is in the current week
 */
const isDateInCurrentWeek = (date: Date): boolean => {
  const now = new Date();
  const currentWeekStart = getWeekStart();
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
  
  return date >= currentWeekStart && date < currentWeekEnd;
};

/**
 * Get week number of the year
 */
const getWeekNumber = (date: Date): number => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
};

/**
 * Save weekly report to Firestore
 */
const saveWeeklyReport = async (userId: string, report: WeeklyReport): Promise<void> => {
  const reportId = `${userId}_${report.weekStart.toISOString().split('T')[0]}`;
  const reportRef = doc(db, 'weeklyReports', reportId);
  
  await setDoc(reportRef, {
    ...report,
    weekStart: Timestamp.fromDate(report.weekStart),
    weekEnd: Timestamp.fromDate(report.weekEnd),
    generatedAt: Timestamp.fromDate(report.generatedAt)
  });
};

/**
 * Get user's latest weekly report
 */
export const getLatestWeeklyReport = async (userId: string): Promise<WeeklyReport | null> => {
  try {
    const reportsQuery = query(
      collection(db, 'weeklyReports'),
      where('userId', '==', userId),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(reportsQuery);
    
    if (snapshot.empty) {
      return null;
    }

    const reportData = snapshot.docs[0].data();
    return {
      ...reportData,
      weekStart: reportData.weekStart.toDate(),
      weekEnd: reportData.weekEnd.toDate(),
      generatedAt: reportData.generatedAt.toDate()
    } as WeeklyReport;
  } catch (error) {
    console.error('Error fetching latest weekly report:', error);
    return null;
  }
};

/**
 * Check if user has a report for current week
 */
export const hasCurrentWeekReport = async (userId: string): Promise<boolean> => {
  const weekStart = getWeekStart();
  const reportId = `${userId}_${weekStart.toISOString().split('T')[0]}`;
  
  try {
    const reportRef = doc(db, 'weeklyReports', reportId);
    const reportDoc = await getDoc(reportRef);
    return reportDoc.exists();
  } catch (error) {
    console.error('Error checking for current week report:', error);
    return false;
  }
};

/**
 * Generate analytics for a specific week by date
 * Useful for historical analysis from the 1st of each month
 */
export const generateAnalyticsForWeek = async (userId: string, weekStartDate: Date): Promise<WeeklyReport> => {
  // Ensure the date is set to the start of the day
  const normalizedStartDate = new Date(weekStartDate);
  normalizedStartDate.setHours(0, 0, 0, 0);
  
  return await generateWeeklyAnalytics(userId, normalizedStartDate);
};

/**
 * Get all possible week start dates for a given month
 * Users can generate reports for any of these weeks
 */
export const getAvailableWeeksForMonth = (year: number, month: number): Date[] => {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  
  const weeks: Date[] = [];
  
  // Start from the first Monday of the month (or before if month starts mid-week)
  let currentDate = new Date(firstOfMonth);
  const firstDayOfWeek = currentDate.getDay();
  
  // Adjust to get the Monday of the week containing the 1st
  const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  currentDate.setDate(currentDate.getDate() - daysToSubtract);
  
  // Generate all week starts that overlap with the month
  while (currentDate <= lastOfMonth) {
    // Include this week if it has any days in the target month
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    if (weekEnd >= firstOfMonth && currentDate <= lastOfMonth) {
      weeks.push(new Date(currentDate));
    }
    
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
};

/**
 * Check if analytics can be generated for a specific week
 * (Ensures the week has ended or is the current week)
 */
export const canGenerateAnalyticsForWeek = (weekStartDate: Date): boolean => {
  const now = new Date();
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  
  // Can generate if week has ended or is current week
  return weekEndDate <= now || isDateInCurrentWeek(weekStartDate);
};

/**
 * Get formatted week display string
 */
export const getWeekDisplayString = (weekStartDate: Date): string => {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  
  const startMonth = weekStartDate.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEndDate.toLocaleDateString('en-US', { month: 'short' });
  
  if (startMonth === endMonth) {
    return `${startMonth} ${weekStartDate.getDate()}-${weekEndDate.getDate()}, ${weekStartDate.getFullYear()}`;
  } else {
    return `${startMonth} ${weekStartDate.getDate()} - ${endMonth} ${weekEndDate.getDate()}, ${weekStartDate.getFullYear()}`;
  }
}; 