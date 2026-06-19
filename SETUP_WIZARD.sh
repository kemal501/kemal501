#!/bin/bash

# BARCA-LIVE Setup Wizard
# Automated setup script for quick deployment

echo "🎬 ========================================="
echo "   BARCA-LIVE Setup Wizard"
echo "   Complete Platform Setup"
echo "========================================="
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="Mac"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="Windows"
else
    OS="Unknown"
fi

echo "📱 Detected OS: $OS"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    echo "   Please install Node.js from: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js found: $NODE_VERSION"
echo ""

# Menu
echo "🎯 Choose setup option:"
echo ""
echo "1. Frontend Only (Browser)"
echo "2. Frontend + Backend (Local Dev)"
echo "3. Docker (All Services)"
echo "4. Production Setup"
echo "5. Android Setup"
echo "6. Exit"
echo ""
read -p "Enter choice (1-6): " choice

case $choice in
    1)
        echo ""
        echo "🎬 Frontend Setup"
        echo "================="
        echo ""
        echo "To run the frontend:"
        echo "1. Download: FRONTEND_COMPLETE.html"
        echo "2. Open in any browser"
        echo "3. Done! ✅"
        echo ""
        read -p "Press Enter to open in browser..."
        if [[ "$OS" == "Mac" ]]; then
            open FRONTEND_COMPLETE.html
        elif [[ "$OS" == "Linux" ]]; then
            xdg-open FRONTEND_COMPLETE.html
        elif [[ "$OS" == "Windows" ]]; then
            start FRONTEND_COMPLETE.html
        fi
        ;;
    2)
        echo ""
        echo "🔧 Backend Setup"
        echo "================"
        echo ""
        
        # Create backend directory
        mkdir -p barca-backend
        cd barca-backend
        
        # Copy files
        cp ../BACKEND_COMPLETE.js server.js
        cp ../BACKEND_PACKAGE_JSON.json package.json
        cp ../ENVIRONMENT_EXAMPLE.env .env
        
        echo "📁 Created: barca-backend/"
        echo ""
        echo "⚠️  Important: Edit .env with Firebase credentials"
        echo "   Open: .env"
        echo "   Add your Firebase project details"
        echo ""
        
        # Install dependencies
        echo "📦 Installing dependencies..."
        npm install
        
        echo ""
        echo "✅ Setup complete!"
        echo ""
        echo "To start backend:"
        echo "cd barca-backend"
        echo "npm start"
        echo ""
        echo "Server will run on: http://localhost:5000"
        ;;
    3)
        echo ""
        echo "🐳 Docker Setup"
        echo "==============="
        echo ""
        
        # Check Docker
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker not found!"
            echo "   Please install Docker from: https://www.docker.com"
            exit 1
        fi
        
        echo "✅ Docker found"
        echo ""
        
        # Check docker-compose
        if ! command -v docker-compose &> /dev/null; then
            echo "❌ Docker Compose not found!"
            echo "   Please install Docker Compose"
            exit 1
        fi
        
        echo "✅ Docker Compose found"
        echo ""
        
        # Start services
        echo "🚀 Starting services..."
        docker-compose up -d
        
        echo ""
        echo "✅ Services started!"
        echo ""
        echo "Access:"
        echo "  Frontend: http://localhost:3000"
        echo "  Backend: http://localhost:5000"
        echo "  Redis: localhost:6379"
        echo ""
        echo "To stop:"
        echo "  docker-compose down"
        ;;
    4)
        echo ""
        echo "🌐 Production Setup"
        echo "==================="
        echo ""
        echo "Follow these steps to deploy to production:"
        echo ""
        echo "1. Backend (Heroku):"
        echo "   - heroku create app-name"
        echo "   - heroku config:set FIREBASE_PROJECT_ID=xxx"
        echo "   - git push heroku main"
        echo ""
        echo "2. Frontend (Firebase):"
        echo "   - firebase init hosting"
        echo "   - firebase deploy --only hosting"
        echo ""
        echo "3. Android:"
        echo "   - ./gradlew assembleRelease"
        echo "   - Upload to Google Play Console"
        echo ""
        echo "See DEPLOYMENT_GUIDE.md for detailed steps"
        ;;
    5)
        echo ""
        echo "📱 Android Setup"
        echo "================"
        echo ""
        echo "To setup Android app:"
        echo ""
        echo "1. Install Android Studio"
        echo "2. Open Android project"
        echo "3. Copy ANDROID_MAIN_ACTIVITY.kt to:"
        echo "   app/src/main/java/com/barcalive/app/"
        echo ""
        echo "4. Copy ANDROID_BUILD_GRADLE.gradle to:"
        echo "   app/build.gradle"
        echo ""
        echo "5. Sync Gradle in Android Studio"
        echo "6. Build and run:"
        echo "   ./gradlew assembleDebug"
        echo ""
        echo "To generate release APK:"
        echo "   ./gradlew assembleRelease"
        ;;
    6)
        echo "Goodbye! 👋"
        exit 0
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "For more help, see:"
echo "  • README_START_HERE.md"
echo "  • DEPLOYMENT_GUIDE.md"
echo "  • QUICK_REFERENCE_GUIDE.md"
echo ""
