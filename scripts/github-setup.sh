#!/bin/bash

# GitHub setup script
# This script initializes a Git repository and pushes it to GitHub

# Text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}GitHub Repository Setup${NC}"
echo "============================="
echo ""

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Git is not installed. Please install Git first.${NC}"
    exit 1
fi

# Check if we're in the nodejs directory
if [ "$(basename "$PWD")" != "nodejs" ]; then
    echo -e "${RED}Please run this script from the nodejs directory.${NC}"
    exit 1
fi

# Initialize Git repository if it doesn't exist
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Initializing Git repository...${NC}"
    git init
    echo -e "${GREEN}Git repository initialized.${NC}"
else
    echo -e "${YELLOW}Git repository already exists.${NC}"
fi

# Verify the .gitignore file exists
if [ ! -f ".gitignore" ]; then
    echo -e "${RED}.gitignore file not found. Please create it first.${NC}"
    exit 1
fi

# Ask for GitHub repository details
echo ""
echo -e "${YELLOW}Please enter your GitHub repository details:${NC}"
read -p "GitHub username: " github_username
read -p "Repository name: " repo_name

# Confirm details
echo ""
echo -e "${YELLOW}Repository will be: https://github.com/$github_username/$repo_name${NC}"
read -p "Is this correct? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo -e "${RED}Setup aborted. Please run the script again with correct details.${NC}"
    exit 1
fi

# Add remote origin
echo ""
echo -e "${YELLOW}Adding remote origin...${NC}"
git remote remove origin 2>/dev/null
git remote add origin "https://github.com/$github_username/$repo_name.git"
echo -e "${GREEN}Remote origin added.${NC}"

# Add all files
echo ""
echo -e "${YELLOW}Adding files to Git...${NC}"
git add .
echo -e "${GREEN}Files added.${NC}"

# Initial commit
echo ""
echo -e "${YELLOW}Creating initial commit...${NC}"
git commit -m "Initial commit: NodeJS API with PhonePe integration"
echo -e "${GREEN}Commit created.${NC}"

# Instructions for pushing to GitHub
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Create a new repository on GitHub: https://github.com/new"
echo "   - Name: $repo_name"
echo "   - Set to Public or Private as needed"
echo "   - Do NOT initialize with README, .gitignore, or license"
echo ""
echo "2. After creating the repository, push your code:"
echo "   git push -u origin main"
echo ""
echo -e "${YELLOW}Would you like to push to GitHub now? (y/n):${NC}"
read -p "" push_now

if [ "$push_now" = "y" ]; then
    echo ""
    echo -e "${YELLOW}Pushing to GitHub...${NC}"
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Successfully pushed to GitHub!${NC}"
        echo "Repository URL: https://github.com/$github_username/$repo_name"
    else
        echo -e "${RED}Push failed. You may need to create the repository on GitHub first or check your credentials.${NC}"
        echo "After creating the repository, try pushing manually:"
        echo "git push -u origin main"
    fi
else
    echo ""
    echo -e "${YELLOW}You can push manually later with:${NC}"
    echo "git push -u origin main"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}" 