#!/bin/bash
# Script to push changes to GitHub

# Set colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=======================================${NC}"
echo -e "${YELLOW}    Pushing Node.js API to GitHub     ${NC}"
echo -e "${YELLOW}=======================================${NC}"

# Get current directory
CURRENT_DIR=$(pwd)

# Navigate to the nodejs directory if not already there
if [[ "$CURRENT_DIR" != *"/nodejs" ]]; then
  if [ -d "./nodejs" ]; then
    cd ./nodejs
    echo -e "${GREEN}Changed directory to $(pwd)${NC}"
  else
    echo -e "${RED}Error: Cannot find nodejs directory.${NC}"
    echo "Please run this script from the project root or nodejs directory."
    exit 1
  fi
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
  echo -e "${YELLOW}Initializing git repository...${NC}"
  git init
  
  # Ask for GitHub repository URL
  echo "Enter your GitHub repository URL (https://github.com/username/repository.git):"
  read REPO_URL
  
  git remote add origin $REPO_URL
  echo -e "${GREEN}Git repository initialized and remote origin added.${NC}"
else
  echo -e "${GREEN}Git repository already initialized.${NC}"
fi

# Check git status
echo -e "${YELLOW}Checking git status...${NC}"
git status

# Add all files to staging
echo -e "${YELLOW}Adding files to staging...${NC}"
git add .

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
echo "Enter commit message (default: 'Added API caching and CDN image URL improvements'):"
read COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="Added API caching and CDN image URL improvements"
fi

git commit -m "$COMMIT_MSG"

# Push to GitHub
echo -e "${YELLOW}Pushing to GitHub...${NC}"
echo "Enter branch name (default: main):"
read BRANCH_NAME
if [ -z "$BRANCH_NAME" ]; then
  BRANCH_NAME="main"
fi

git push -u origin $BRANCH_NAME

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Successfully pushed to GitHub!${NC}"
  echo -e "${GREEN}Repository URL: $(git remote get-url origin)${NC}"
else
  echo -e "${RED}Failed to push to GitHub.${NC}"
  echo "Please check your credentials and try again."
  echo "You may need to run: git push -u origin $BRANCH_NAME"
fi

echo -e "${YELLOW}=======================================${NC}"
echo -e "${YELLOW}             Complete!                 ${NC}"
echo -e "${YELLOW}=======================================${NC}" 