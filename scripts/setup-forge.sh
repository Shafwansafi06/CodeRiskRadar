#!/bin/bash

# Code Risk Radar - Forge App Setup Script
# Automates the initial setup and deployment

set -e  # Exit on error

echo "=========================================="
echo "🛡️  Code Risk Radar - Forge Setup"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "📋 Step 1: Checking prerequisites..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher (current: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm -v)${NC}"

# Check Forge CLI
if ! command -v forge &> /dev/null; then
    echo -e "${YELLOW}⚠️  Forge CLI not found${NC}"
    echo "Installing Forge CLI globally..."
    npm install -g @forge/cli
    echo -e "${GREEN}✅ Forge CLI installed${NC}"
else
    echo -e "${GREEN}✅ Forge CLI $(forge --version)${NC}"
fi

echo ""

# Step 2: Check Forge authentication
echo "📋 Step 2: Checking Forge authentication..."
echo ""

if ! forge whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Forge${NC}"
    echo "Please login to Forge..."
    forge login
else
    FORGE_USER=$(forge whoami)
    echo -e "${GREEN}✅ Logged in as: $FORGE_USER${NC}"
fi

echo ""

# Step 3: Copy configuration files
echo "📋 Step 3: Setting up configuration..."
echo ""

if [ ! -f "manifest.yml" ]; then
    echo "Copying Forge manifest..."
    cp manifest.forge.yml manifest.yml
    echo -e "${GREEN}✅ manifest.yml created${NC}"
else
    echo -e "${YELLOW}⚠️  manifest.yml already exists, skipping${NC}"
fi

if [ ! -f "package.json" ]; then
    echo "Copying package.json..."
    cp package.forge.json package.json
    echo -e "${GREEN}✅ package.json created${NC}"
else
    echo -e "${YELLOW}⚠️  package.json already exists, skipping${NC}"
fi

echo ""

# Step 4: Install dependencies
echo "📋 Step 4: Installing dependencies..."
echo ""

echo "Installing backend dependencies..."
npm install
echo -e "${GREEN}✅ Backend dependencies installed${NC}"

echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"

echo ""

# Step 5: Build frontend
echo "📋 Step 5: Building frontend..."
echo ""

cd frontend
npm run build
cd ..

if [ -d "frontend/build" ]; then
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo ""

# Step 6: Environment variables
echo "📋 Step 6: Configuring environment variables..."
echo ""

echo -e "${YELLOW}Do you want to configure environment variables now? (y/n)${NC}"
read -r CONFIGURE_ENV

if [ "$CONFIGURE_ENV" = "y" ] || [ "$CONFIGURE_ENV" = "Y" ]; then
    echo ""
    echo "Enter GitHub Personal Access Token (for PR comments):"
    echo "(Leave empty to skip)"
    read -r GITHUB_TOKEN
    
    if [ -n "$GITHUB_TOKEN" ]; then
        forge variables set GITHUB_TOKEN "$GITHUB_TOKEN"
        echo -e "${GREEN}✅ GITHUB_TOKEN configured${NC}"
    fi
    
    echo ""
    echo "Enter Supabase URL (for embeddings - optional):"
    read -r SUPABASE_URL
    
    if [ -n "$SUPABASE_URL" ]; then
        forge variables set SUPABASE_URL "$SUPABASE_URL"
        echo -e "${GREEN}✅ SUPABASE_URL configured${NC}"
        
        echo "Enter Supabase Anon Key:"
        read -r SUPABASE_KEY
        
        if [ -n "$SUPABASE_KEY" ]; then
            forge variables set SUPABASE_KEY "$SUPABASE_KEY"
            echo -e "${GREEN}✅ SUPABASE_KEY configured${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Skipping environment variable configuration${NC}"
    echo "You can configure them later with: forge variables set KEY value"
fi

echo ""

# Step 7: Deploy
echo "📋 Step 7: Deploying to Forge..."
echo ""

echo -e "${YELLOW}Ready to deploy? (y/n)${NC}"
read -r DEPLOY_NOW

if [ "$DEPLOY_NOW" = "y" ] || [ "$DEPLOY_NOW" = "Y" ]; then
    forge deploy
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Deployment successful${NC}"
        
        echo ""
        echo "📋 Step 8: Installing to workspace..."
        echo ""
        
        echo -e "${YELLOW}Install to workspace now? (y/n)${NC}"
        read -r INSTALL_NOW
        
        if [ "$INSTALL_NOW" = "y" ] || [ "$INSTALL_NOW" = "Y" ]; then
            forge install
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Installation successful${NC}"
            else
                echo -e "${RED}❌ Installation failed${NC}"
                echo "You can install later with: forge install"
            fi
        else
            echo -e "${YELLOW}⚠️  Skipping installation${NC}"
            echo "Install later with: forge install"
        fi
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        echo "Check the errors above and try again with: forge deploy"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Skipping deployment${NC}"
    echo "Deploy later with: forge deploy"
fi

echo ""
echo "=========================================="
echo "🎉 Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Open a PR in your Bitbucket/GitHub repository"
echo "2. Look for 'Code Risk Radar' in the PR sidebar"
echo "3. Check logs: forge logs"
echo ""
echo "Documentation:"
echo "- Deployment Guide: FORGE_DEPLOYMENT.md"
echo "- Frontend Integration: frontend/INTEGRATION_GUIDE.md"
echo ""
echo "Useful commands:"
echo "  forge tunnel          # Start development tunnel"
echo "  forge logs            # View logs"
echo "  forge install --list  # List installations"
echo ""
echo "Happy coding! 🚀"
