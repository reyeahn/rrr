@echo off
echo.
echo =====================================================
echo  Setting up OpenAI Integration for Music App
echo =====================================================
echo.

cd /d "%~dp0"

echo [1/3] Installing OpenAI package...
npm install openai@^4.20.1
if errorlevel 1 (
    echo ERROR: Failed to install OpenAI package
    pause
    exit /b 1
)

echo.
echo [2/3] Checking for .env.local file...
if not exist ".env.local" (
    echo Creating .env.local file...
    echo # Add your OpenAI API key here > .env.local
    echo OPENAI_API_KEY=sk-your-actual-api-key-here >> .env.local
    echo.
    echo ✅ Created .env.local file
) else (
    echo ✅ .env.local already exists
    
    findstr /C:"OPENAI_API_KEY" .env.local >nul
    if errorlevel 1 (
        echo Adding OPENAI_API_KEY to existing .env.local...
        echo. >> .env.local
        echo # OpenAI Configuration >> .env.local
        echo OPENAI_API_KEY=sk-your-actual-api-key-here >> .env.local
        echo ✅ Added OPENAI_API_KEY to .env.local
    ) else (
        echo ✅ OPENAI_API_KEY already in .env.local
    )
)

echo.
echo [3/3] Setup complete!
echo.
echo =====================================================
echo  NEXT STEPS:
echo =====================================================
echo 1. Get your OpenAI API key from: https://platform.openai.com/
echo 2. Edit .env.local and replace "sk-your-actual-api-key-here" with your real key
echo 3. Restart your development server: npm run dev
echo 4. Test by going to Profile > Analytics tab
echo.
echo 📖 For detailed instructions, see OPENAI_SETUP.md
echo =====================================================
echo.
pause 