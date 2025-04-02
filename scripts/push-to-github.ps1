# PowerShell script to push changes to GitHub

Write-Host "=======================================" -ForegroundColor Yellow
Write-Host "    Pushing Node.js API to GitHub     " -ForegroundColor Yellow
Write-Host "=======================================" -ForegroundColor Yellow

# Get current directory
$CURRENT_DIR = Get-Location

# Navigate to the nodejs directory if not already there
if (-not ($CURRENT_DIR -like "*\nodejs")) {
  if (Test-Path ".\nodejs") {
    Set-Location .\nodejs
    Write-Host "Changed directory to $(Get-Location)" -ForegroundColor Green
  } else {
    Write-Host "Error: Cannot find nodejs directory." -ForegroundColor Red
    Write-Host "Please run this script from the project root or nodejs directory."
    exit 1
  }
}

# Check if git is initialized
if (-not (Test-Path ".git")) {
  Write-Host "Initializing git repository..." -ForegroundColor Yellow
  git init
  
  # Ask for GitHub repository URL
  $REPO_URL = Read-Host "Enter your GitHub repository URL (https://github.com/username/repository.git)"
  
  git remote add origin $REPO_URL
  Write-Host "Git repository initialized and remote origin added." -ForegroundColor Green
} else {
  Write-Host "Git repository already initialized." -ForegroundColor Green
}

# Check git status
Write-Host "Checking git status..." -ForegroundColor Yellow
git status

# Add all files to staging
Write-Host "Adding files to staging..." -ForegroundColor Yellow
git add .

# Commit changes
Write-Host "Committing changes..." -ForegroundColor Yellow
$COMMIT_MSG = Read-Host "Enter commit message (press Enter for default: 'Added API caching and CDN image URL improvements')"
if ([string]::IsNullOrEmpty($COMMIT_MSG)) {
  $COMMIT_MSG = "Added API caching and CDN image URL improvements"
}

git commit -m $COMMIT_MSG

# Push to GitHub
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
$BRANCH_NAME = Read-Host "Enter branch name (press Enter for default: main)"
if ([string]::IsNullOrEmpty($BRANCH_NAME)) {
  $BRANCH_NAME = "main"
}

git push -u origin $BRANCH_NAME

if ($LASTEXITCODE -eq 0) {
  Write-Host "Successfully pushed to GitHub!" -ForegroundColor Green
  Write-Host "Repository URL: $(git config --get remote.origin.url)" -ForegroundColor Green
} else {
  Write-Host "Failed to push to GitHub." -ForegroundColor Red
  Write-Host "Please check your credentials and try again."
  Write-Host "You may need to run: git push -u origin $BRANCH_NAME"
}

Write-Host "=======================================" -ForegroundColor Yellow
Write-Host "             Complete!                 " -ForegroundColor Yellow
Write-Host "=======================================" -ForegroundColor Yellow 