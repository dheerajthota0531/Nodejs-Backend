#!/bin/bash

# Ubuntu Deployment Script for Node.js Application
# This script sets up the complete environment for running the Node.js application

# Text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Node.js Application Deployment for Ubuntu${NC}"
echo "========================================"
echo ""

# Check if running as root
if [ "$(id -u)" != "0" ]; then
   echo -e "${RED}This script must be run as root or with sudo${NC}" 
   exit 1
fi

# Ask for the GitHub repository details
echo -e "${YELLOW}Please enter your GitHub repository details:${NC}"
read -p "GitHub repository URL (e.g., https://github.com/username/repo.git): " github_repo

# Ask for database details
echo ""
echo -e "${YELLOW}Please enter MySQL database details:${NC}"
read -p "Database name (default: uzvis_prod): " db_name
db_name=${db_name:-"uzvis_prod"}

read -p "Database user: " db_user
while [ -z "$db_user" ]; do
    echo -e "${RED}Database user cannot be empty${NC}"
    read -p "Database user: " db_user
done

read -sp "Database password: " db_password
echo ""
while [ -z "$db_password" ]; do
    echo -e "${RED}Database password cannot be empty${NC}"
    read -sp "Database password: " db_password
    echo ""
done

# Ask for domain information
echo ""
echo -e "${YELLOW}Please enter domain information:${NC}"
read -p "API domain (e.g., api.example.com): " api_domain
while [ -z "$api_domain" ]; do
    echo -e "${RED}API domain cannot be empty${NC}"
    read -p "API domain (e.g., api.example.com): " api_domain
done

read -p "Frontend domain (e.g., www.example.com): " frontend_domain
while [ -z "$frontend_domain" ]; do
    echo -e "${RED}Frontend domain cannot be empty${NC}"
    read -p "Frontend domain (e.g., www.example.com): " frontend_domain
done

# Confirm the inputs
echo ""
echo -e "${BLUE}Please confirm the following details:${NC}"
echo "GitHub Repository: $github_repo"
echo "Database Name: $db_name"
echo "Database User: $db_user"
echo "API Domain: $api_domain"
echo "Frontend Domain: $frontend_domain"
echo ""
read -p "Is this information correct? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo -e "${RED}Deployment aborted. Please run the script again with correct information.${NC}"
    exit 1
fi

# Step 1: Update system
echo ""
echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}System packages updated.${NC}"

# Step 2: Install required packages
echo ""
echo -e "${YELLOW}Step 2: Installing required packages...${NC}"
apt install -y curl git nginx certbot python3-certbot-nginx

# Install Node.js
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt install -y nodejs
echo -e "${GREEN}Node.js installed: $(node -v)${NC}"

# Install MySQL if not already installed
if ! command -v mysql &> /dev/null; then
    echo "Installing MySQL..."
    apt install -y mysql-server
    echo -e "${GREEN}MySQL installed.${NC}"
else
    echo -e "${GREEN}MySQL is already installed.${NC}"
fi

# Install PM2 globally
echo "Installing PM2..."
npm install -g pm2
echo -e "${GREEN}PM2 installed: $(pm2 -v)${NC}"

# Step 3: Set up MySQL database
echo ""
echo -e "${YELLOW}Step 3: Setting up MySQL database...${NC}"

# Check if database exists
db_exists=$(mysql -e "SHOW DATABASES LIKE '$db_name';" | grep -o "$db_name")
if [ "$db_exists" == "$db_name" ]; then
    echo -e "${GREEN}Database $db_name already exists.${NC}"
else
    echo "Creating database and user..."
    mysql -e "CREATE DATABASE $db_name CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -e "CREATE USER '$db_user'@'localhost' IDENTIFIED BY '$db_password';"
    mysql -e "GRANT ALL PRIVILEGES ON $db_name.* TO '$db_user'@'localhost';"
    mysql -e "FLUSH PRIVILEGES;"
    echo -e "${GREEN}Database and user created successfully.${NC}"
fi

# Step 4: Clone the repository
echo ""
echo -e "${YELLOW}Step 4: Cloning the repository...${NC}"
mkdir -p /var/www
cd /var/www

# Check if the directory already contains the repository
repo_name=$(basename -s .git "$github_repo")
if [ -d "$repo_name" ]; then
    echo -e "${GREEN}Repository directory already exists. Pulling latest changes...${NC}"
    cd "$repo_name"
    git pull
else
    echo "Cloning $github_repo..."
    git clone "$github_repo"
    cd "$repo_name"
fi

# Step 5: Install application dependencies
echo ""
echo -e "${YELLOW}Step 5: Installing application dependencies...${NC}"
cd nodejs
npm install --production
echo -e "${GREEN}Dependencies installed successfully.${NC}"

# Step 6: Create and configure environment file
echo ""
echo -e "${YELLOW}Step 6: Configuring application environment...${NC}"
if [ -f ".env" ]; then
    echo "Backing up existing .env file to .env.backup"
    cp .env .env.backup
fi

# Create new .env file
cat > .env << EOL
# Environment
NODE_ENV=production

# Database connection
DB_HOST=localhost
DB_USER=$db_user
DB_PASSWORD=$db_password
DB_NAME=$db_name

# Server settings
PORT=3000
API_BASE_URL=/api

# JWT Secret
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d

# PhonePe Configuration
PHONEPE_CLIENT_ID=SU2503252031280813644090
PHONEPE_CLIENT_SECRET=c8857ce8-6222-4c8b-a9ba-62ee6be6a7ea
PHONEPE_CLIENT_VERSION=1
PHONEPE_MERCHANT_ID=M220FPIWE4PZD
PHONEPE_ENVIRONMENT=PRODUCTION
MERCHANT_DOMAIN=https://$api_domain
FRONTEND_DOMAIN=https://$frontend_domain
PHONEPE_CALLBACK_USERNAME=merchant_username
PHONEPE_CALLBACK_PASSWORD=merchant_password

# Logging
LOG_LEVEL=info
EOL

echo -e "${GREEN}Environment file created successfully.${NC}"

# Step 7: Configure Nginx
echo ""
echo -e "${YELLOW}Step 7: Configuring Nginx...${NC}"

# Create Nginx configuration for API
cat > /etc/nginx/sites-available/nodejs-api << EOL
server {
    listen 80;
    server_name $api_domain;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOL

# Enable the site
ln -sf /etc/nginx/sites-available/nodejs-api /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

echo -e "${GREEN}Nginx configured successfully.${NC}"

# Step 8: Set up SSL with Let's Encrypt
echo ""
echo -e "${YELLOW}Step 8: Setting up SSL with Let's Encrypt...${NC}"
read -p "Do you want to set up SSL with Let's Encrypt now? (y/n): " setup_ssl

if [ "$setup_ssl" = "y" ]; then
    echo "Running Certbot for API domain..."
    certbot --nginx -d "$api_domain" --non-interactive --agree-tos --email admin@"$api_domain"
    echo -e "${GREEN}SSL certificate configured for $api_domain${NC}"
else
    echo -e "${YELLOW}SSL setup skipped. You can run this manually later:${NC}"
    echo "certbot --nginx -d $api_domain"
fi

# Step 9: Start the application with PM2
echo ""
echo -e "${YELLOW}Step 9: Starting the application with PM2...${NC}"
cd /var/www/$repo_name/nodejs
pm2 delete nodejs-api 2>/dev/null
pm2 start app.js --name "nodejs-api"
pm2 save

# Configure PM2 to start on boot
pm2 startup | tail -n 1 > /tmp/pm2-startup-command.sh
chmod +x /tmp/pm2-startup-command.sh
/tmp/pm2-startup-command.sh

echo -e "${GREEN}Application started with PM2.${NC}"

# Step 10: Set proper permissions
echo ""
echo -e "${YELLOW}Step 10: Setting proper file permissions...${NC}"
chown -R www-data:www-data /var/www/$repo_name
chmod -R 755 /var/www/$repo_name
echo -e "${GREEN}Permissions set.${NC}"

# Step 11: Final instructions
echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Important next steps:${NC}"
echo "1. Register your domains in the PhonePe merchant dashboard:"
echo "   - API Domain: https://$api_domain"
echo "   - Frontend Domain: https://$frontend_domain"
echo ""
echo "2. Check if the application is running correctly:"
echo "   curl https://$api_domain/api/health"
echo ""
echo "3. Check the logs if you encounter any issues:"
echo "   pm2 logs nodejs-api"
echo ""
echo "4. To stop or restart the application:"
echo "   pm2 stop nodejs-api"
echo "   pm2 restart nodejs-api"
echo ""
echo -e "${GREEN}Your Node.js application with PhonePe integration is now deployed!${NC}" 