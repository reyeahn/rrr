# OpenAI API Setup Guide

This guide will help you set up OpenAI API for the AI-powered analytics features in your music app.

## Prerequisites

- OpenAI API account
- API key with appropriate permissions
- Your music app already running with Firebase

## Step 1: Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy the API key (starts with `sk-...`)

⚠️ **Important**: Keep this key secure and never commit it to version control!

## Step 2: Set Up Environment Variables

1. **Create `.env.local` file** in your musicapp directory (if it doesn't exist):
   ```bash
   cd musicapp
   touch .env.local  # On Windows: echo. > .env.local
   ```

2. **Add your OpenAI API key** to `.env.local`:
   ```env
   # Add this line to your existing .env.local file
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. **Example complete `.env.local` file**:
   ```env
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   ```

## Step 3: Install Dependencies

Install the OpenAI package:

```bash
cd musicapp
npm install openai@^4.20.1
```

## Step 4: Restart Development Server

After adding the environment variable, restart your development server:

```bash
npm run dev
```

## Step 5: Test the Integration

1. **Log into your app**
2. **Go to Profile > Analytics tab**
3. **Click "Generate Report"**
4. **Check browser console** for any errors

### Expected Behavior:
- ✅ **With OpenAI API**: Get sophisticated AI-generated insights
- ✅ **Without OpenAI API**: Fall back to rule-based insights (still works!)

## API Usage & Costs

### Model Used:
- **GPT-4-turbo-preview** for high-quality music psychology analysis

### Estimated Costs:
- **~$0.01-0.03 per weekly report** (depending on user data)
- **~$0.50-1.50 per month** for active user

### Usage Limits:
- Analytics are generated on-demand (not automatic)
- Falls back gracefully if API fails or quota exceeded

## Troubleshooting

### Common Issues:

1. **"OpenAI service not available" error**
   - Check that `OPENAI_API_KEY` is set in `.env.local`
   - Restart development server after adding the key
   - Verify the API key is valid

2. **API quota exceeded**
   - Check your OpenAI usage dashboard
   - Add billing method if needed
   - App will fall back to rule-based insights

3. **Rate limit errors**
   - OpenAI has rate limits for new accounts
   - Wait a few minutes and try again
   - Consider upgrading OpenAI plan for higher limits

### Debug Steps:

1. **Check environment variables**:
   ```bash
   # In your terminal (from musicapp directory)
   echo $OPENAI_API_KEY  # Should show your key
   ```

2. **Check browser console** for error messages

3. **Verify API key** at OpenAI dashboard

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use `.env.local`** for local development
3. **Use proper environment variables** for production
4. **Rotate keys periodically**
5. **Monitor usage** in OpenAI dashboard

## Features Powered by OpenAI

### AI Analytics Include:
- **Personalized music psychology insights**
- **Sophisticated mood pattern analysis**
- **Contextual listening behavior analysis**
- **Personalized engagement recommendations**
- **Weekly highlights and achievements**

### Fallback System:
If OpenAI is unavailable, the app automatically uses:
- Rule-based mood analysis
- Basic engagement metrics
- Statistical insights
- Standard recommendations

## Production Deployment

For production, set the environment variable in your hosting platform:

### Vercel:
```bash
vercel env add OPENAI_API_KEY
```

### Netlify:
Add `OPENAI_API_KEY` in Site Settings > Environment Variables

### Other platforms:
Check platform-specific documentation for environment variables

## Support

If you encounter issues:
1. Check this troubleshooting guide
2. Verify OpenAI API key and quota
3. Check browser console for errors
4. Ensure all dependencies are installed

The AI analytics feature is designed to enhance the user experience but the app works perfectly without it! 