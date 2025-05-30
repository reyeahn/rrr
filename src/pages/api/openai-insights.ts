import { NextApiRequest, NextApiResponse } from 'next';

// Define the expected structure of OpenAI insights
interface OpenAIInsights {
  personalizedInsights: string[];
  musicTasteAnalysis: string;
  moodPatternAnalysis: string;
  engagementAdvice: string[];
  weeklyHighlights: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return res.status(503).json({ error: 'OpenAI service not available' });
    }

    // Dynamic import to handle missing package gracefully
    let OpenAI;
    try {
      const openaiModule = await import('openai');
      OpenAI = openaiModule.default;
    } catch (importError) {
      console.error('OpenAI package not installed:', importError);
      return res.status(503).json({ error: 'OpenAI service not available' });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview', // More stable model
      messages: [
        {
          role: 'system',
          content: 'You are a music psychology expert specializing in analyzing music listening patterns and social engagement. Provide insights that are empathetic, encouraging, and actionable. IMPORTANT: Respond with raw JSON only - do not wrap your response in markdown code blocks or any other formatting. Return only the JSON object with the exact fields requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let insights: OpenAIInsights;
    try {
      // Clean the response to handle markdown code blocks
      let cleanedResponse = responseText.trim();
      
      // Remove markdown code block markers if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Final trim to ensure clean JSON
      cleanedResponse = cleanedResponse.trim();
      
      insights = JSON.parse(cleanedResponse) as OpenAIInsights;
      
      // Validate required fields
      const requiredFields = ['personalizedInsights', 'musicTasteAnalysis', 'moodPatternAnalysis', 'engagementAdvice', 'weeklyHighlights'];
      const missingFields = requiredFields.filter(field => !insights[field as keyof OpenAIInsights]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', responseText);
      console.error('Parse error:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    res.status(200).json({ 
      insights,
      usage: completion.usage 
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // Return structured error response
    if (error instanceof Error) {
      return res.status(500).json({ 
        error: 'Failed to generate insights',
        details: error.message 
      });
    }
    
    return res.status(500).json({ 
      error: 'An unexpected error occurred' 
    });
  }
} 