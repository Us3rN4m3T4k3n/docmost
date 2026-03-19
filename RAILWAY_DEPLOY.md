# Railway Deployment Guide for Docmost

## Prerequisites
- GitHub account with your forked repository
- Railway account (sign up at railway.app)

## Quick Deploy (Web UI - Recommended)

### 1. Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `Us3rN4m3T4k3n/docmost`
5. Select the `development` branch

### 2. Add Database Services

#### Add PostgreSQL:
1. Click "+ New" in your project
2. Select "Database" → "PostgreSQL"
3. Railway automatically creates `DATABASE_URL`

#### Add Redis:
1. Click "+ New" again
2. Select "Database" → "Redis"
3. Railway automatically creates `REDIS_URL`

### 3. Configure Environment Variables

Go to your Docmost service → "Variables" tab and add:

```bash
# REQUIRED
APP_SECRET=7ba7567b951f056ac9c84f74bfa11d1768371f8a5b44283d840b041fa3cf6826
APP_URL=https://your-app.railway.app  # Update after first deploy
PORT=8080
JWT_TOKEN_EXPIRES_IN=30d
STORAGE_DRIVER=local

# OPTIONAL - Email Configuration
MAIL_DRIVER=smtp
MAIL_FROM_ADDRESS=hello@yourdomain.com
MAIL_FROM_NAME=Docmost
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_SECURE=false

# OPTIONAL - Other Settings
DISABLE_TELEMETRY=false
DEBUG_MODE=false
FILE_UPLOAD_SIZE_LIMIT=50mb
```

**Note:** `DATABASE_URL` and `REDIS_URL` are automatically set by Railway

### 4. Deploy
1. Railway will automatically start building and deploying
2. Monitor the build logs in the "Deployments" tab
3. Once deployed, Railway will provide a public URL

### 5. Post-Deployment
1. Copy your Railway app URL (e.g., `https://docmost-production-xxxx.up.railway.app`)
2. Update the `APP_URL` environment variable with this URL
3. Railway will automatically redeploy

### 6. Access Your App
- Open your Railway URL
- Complete the initial workspace setup
- Create your admin account

---

## CLI Deployment (Alternative)

### 1. Install Railway CLI
```bash
# macOS/Linux
brew install railway

# Or using npm
npm install -g @railway/cli
```

### 2. Login to Railway
```bash
railway login
```

### 3. Initialize Project
```bash
cd /Users/rafaelandresberti/docmost
railway init
```

### 4. Add Services
```bash
# Link to your Railway project
railway link

# Add PostgreSQL
railway add --service postgres

# Add Redis
railway add --service redis
```

### 5. Set Environment Variables
```bash
railway variables set APP_SECRET=7ba7567b951f056ac9c84f74bfa11d1768371f8a5b44283d840b041fa3cf6826
railway variables set PORT=8080
railway variables set JWT_TOKEN_EXPIRES_IN=30d
railway variables set STORAGE_DRIVER=local
railway variables set APP_URL=https://your-app.railway.app
```

### 6. Deploy
```bash
# Deploy from local directory
railway up

# Or connect to GitHub and deploy
railway up --detach
```

### 7. View Logs
```bash
railway logs
```

### 8. Open in Browser
```bash
railway open
```

---

## Important Notes

### Storage Configuration
- **Default:** `STORAGE_DRIVER=local` (files stored in container)
- **Recommended for Production:** Use S3 for persistent storage
  ```bash
  STORAGE_DRIVER=s3
  AWS_S3_ACCESS_KEY_ID=your-key
  AWS_S3_SECRET_ACCESS_KEY=your-secret
  AWS_S3_REGION=us-east-1
  AWS_S3_BUCKET=your-bucket-name
  ```

### Email Configuration
For user invitations to work, configure SMTP:
- **Gmail:** Use app-specific password
- **SendGrid:** Use API key as SMTP password
- **Postmark:** Set `MAIL_DRIVER=postmark` and `POSTMARK_TOKEN`

### Custom Domain
1. In Railway dashboard, go to your service → "Settings"
2. Scroll to "Domains"
3. Click "Generate Domain" or add custom domain
4. Update `APP_URL` with your custom domain

### Database Backups
- Railway provides automatic backups for PostgreSQL
- Access via "Backups" tab in your database service

### Monitoring
- View logs: Railway dashboard → "Deployments" → Click on deployment
- Health checks: Automatically configured at `/api/health/live`
- Metrics: Available in Railway dashboard

---

## Troubleshooting

### Build Fails
- Check Docker build logs in Railway dashboard
- Ensure `package.json` and `pnpm-lock.yaml` are committed
- Verify Node version (requires Node 22)

### App Crashes on Start
- Check logs: `railway logs`
- Verify `DATABASE_URL` and `REDIS_URL` are set
- Ensure `APP_SECRET` is at least 32 characters
- Check migrations ran successfully

### Cannot Access App
- Verify deployment is "Active" in Railway dashboard
- Check `APP_URL` environment variable matches Railway URL
- Ensure PORT is set to 8080

### Database Connection Issues
- Verify PostgreSQL service is running
- Check `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
- Ensure database migrations ran (check logs)

---

## Cost Estimates

Railway pricing (as of 2024):
- **Developer Plan:** $5/month + usage
- **PostgreSQL:** ~$5/month for basic usage
- **Redis:** ~$5/month for basic usage
- **Total:** ~$15-20/month for small-medium usage

**Free Trial:** Railway offers $5 free credits per month for hobby projects

---

## Next Steps After Deployment

1. ✅ Access your app at the Railway URL
2. ✅ Complete workspace setup
3. ✅ Create admin account
4. ✅ Configure email settings for invitations
5. ✅ (Optional) Set up custom domain
6. ✅ (Optional) Configure S3 storage
7. ✅ (Optional) Set up monitoring/alerts

---

## Resources

- [Railway Documentation](https://docs.railway.app)
- [Docmost Documentation](https://docmost.com/docs)
- [Railway Discord](https://discord.gg/railway)
- GitHub Repository: https://github.com/Us3rN4m3T4k3n/docmost

---

## Quick Reference Commands

```bash
# View environment variables
railway variables

# View logs
railway logs

# Restart service
railway restart

# Open Railway dashboard
railway open

# Run database migrations
railway run pnpm --filter server run migration:latest

# Connect to PostgreSQL
railway connect postgres

# Connect to Redis
railway connect redis
```

