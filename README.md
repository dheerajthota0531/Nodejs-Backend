# E-Commerce API - Node.js Implementation

This is the Node.js implementation of the e-commerce API, including PhonePe payment gateway integration.

## PhonePe Payment Gateway Integration

This project includes integration with the PhonePe payment gateway, allowing customers to make payments using UPI, credit/debit cards, and net banking.

### Configuration

PhonePe configuration is stored in `config/phonepe.config.js`. The following environment variables can be set:

```
PHONEPE_CLIENT_ID=SU2503252031280813644090
PHONEPE_CLIENT_SECRET=c8857ce8-6222-4c8b-a9ba-62ee6be6a7ea
PHONEPE_CLIENT_VERSION=1
PHONEPE_MERCHANT_ID=M220FPIWE4PZD
PHONEPE_ENVIRONMENT=SANDBOX
MERCHANT_DOMAIN=https://yourdomain.com
MOBILE_APP_SCHEME=myapp://
```

### Payment Flow

1. When a user selects "PhonePe" as the payment method during checkout, the order is created with `payment_required: true`.
2. The frontend should then make a request to `/app/v1/api/phonepe/initiate` with the order details.
3. The backend will return a redirect URL to PhonePe's payment page.
4. After payment completion, PhonePe redirects the user back to our application.
5. The backend also receives a server-to-server callback with payment status.

### API Endpoints

#### Initiate Payment

```
POST /app/v1/api/phonepe/initiate
{
  "user_id": "123",
  "order_id": "456",
  "amount": 1000.50,
  "platform": "web" // or "app" for mobile
}
```

#### Check Payment Status

```
POST /app/v1/api/phonepe/status
{
  "merchant_order_id": "ORDER_456_1234567890"
}
```

#### Payment Callback (Server-to-Server)

PhonePe will send callbacks to `/api/payment/phonepe-callback` with payment status updates.

#### Payment Redirect

After payment, users are redirected to `/api/payment/response` with payment status in query parameters.

### Mobile App Integration

For mobile apps, the system supports deep linking. When a payment is completed, users are redirected back to the app using the configured app scheme (e.g., `myapp://payment/success?orderId=123`).

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start
```

## Documentation

For detailed documentation on the PhonePe integration, see `docs/phonepe-integration.md`.

## Credits

This project is a Node.js implementation of the PHP e-commerce API, maintaining API compatibility while improving performance and maintainability.

# Node.js API Server

This repository contains the backend API server for the e-commerce application with PhonePe payment integration.

## Prerequisites

- Node.js v14+
- MySQL/MariaDB
- PM2 (for production deployment)

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create `.env` file (see `.env.production.example` for template)
4. Run the development server:
   ```
   npm run dev
   ```

## Production Deployment to Ubuntu VM

### 1. Install Required Software on Ubuntu

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL (if not already installed)
sudo apt install -y mysql-server

# Secure MySQL installation
sudo mysql_secure_installation

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Set Up the Database

```bash
# Log into MySQL
sudo mysql

# Create database and user (in MySQL shell)
CREATE DATABASE uzvis_prod;
CREATE USER 'youruser'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON uzvis_prod.* TO 'youruser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Clone and Configure the Application

```bash
# Create directory for application
mkdir -p /var/www
cd /var/www

# Clone repository from GitHub
git clone https://github.com/yourusername/your-repo-name.git
cd your-repo-name/nodejs

# Install dependencies
npm install --production

# Create production environment file
cp .env.production.example .env
nano .env  # Edit the file with your production settings
```

### 4. Configure Nginx as Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/nodejs-app

# Add the following configuration (replace yourdomain.com with your actual domain)
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Enable the site
sudo ln -s /etc/nginx/sites-available/nodejs-app /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

### 5. Set Up SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# This will automatically modify your Nginx configuration
```

### 6. Start the Application with PM2

```bash
# Navigate to app directory
cd /var/www/your-repo-name/nodejs

# Start the application with PM2
pm2 start app.js --name "nodejs-api"

# Make PM2 start on system reboot
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your-user-name --hp /home/your-user-name
pm2 save
```

### 7. Configure PhonePe Production Settings

1. Update your .env file with your production domains
2. Register your production domains in the PhonePe merchant dashboard
3. Test the integration with a small amount

## Important Security Notes

- Always use HTTPS in production
- Set secure file permissions: `sudo chown -R $USER:www-data /var/www/your-repo-name`
- Keep your .env file secure and never commit it to source control

## Troubleshooting

Run the PhonePe test script to verify credentials:

```
node scripts/test-phonepe-connection.js
```

Check logs for more detailed error information:

```
pm2 logs nodejs-api
```
