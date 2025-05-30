@echo off
echo Setting up Node.js environment...

:: Use full paths to Node.js and npm
set NODE_PATH=C:\Program Files\nodejs\node.exe
set NPM_PATH=C:\Program Files\nodejs\npm.cmd

:: Verify Node.js and npm are accessible
echo Node.js version:
"%NODE_PATH%" -v
echo npm version:
"%NPM_PATH%" -v

:: Install dependencies if needed
echo Checking if dependencies are installed...
if not exist node_modules (
  echo Installing dependencies...
  "%NPM_PATH%" install
) else (
  echo Dependencies already installed.
)

:: Start the development server
echo Starting development server...
"%NPM_PATH%" run dev

pause 