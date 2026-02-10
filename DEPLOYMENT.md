# RouCraft Deployment Guide

This guide explains how to deploy RouCraft to Cloudflare Pages (frontend) and Scalingo (backend).

## Prerequisites

1. Cloudflare account with Pages enabled
2. Scalingo account
3. Git repository (GitHub, GitLab, or Bitbucket)

## Backend Deployment (Scalingo)

### 1. Create Scalingo App

```bash
# Install Scalingo CLI if not already installed
curl -O https://cli-dl.scalingo.io/install && bash install

# Login to Scalingo
scalingo login

# Create a new app
scalingo create roucraft-backend
```

### 2. Configure Environment Variables

```bash
# Set the frontend URL (update with your Cloudflare Pages URL)
scalingo --app roucraft-backend env-set FRONTEND_URL=https://roucraft.pages.dev
```

### 3. Deploy to Scalingo

```bash
# Add Scalingo remote
git remote add scalingo git@ssh.osc-fr1.scalingo.com:roucraft-backend.git

# Deploy
git push scalingo main:master
```

### 4. Enable WebSocket Support

Scalingo supports WebSockets by default. Your backend will be available at:
- HTTP: `https://roucraft-backend.osc-fr1.scalingo.io`
- WebSocket: `wss://roucraft-backend.osc-fr1.scalingo.io`

## Frontend Deployment (Cloudflare Pages)

### 1. Build the Frontend Locally First

```bash
# Create production build
npm run build:client
```

### 2. Deploy via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > Pages
2. Click "Create a project"
3. Connect to Git provider and select your repository
4. Configure build settings:
   - Build command: `npm run build:client`
   - Build output directory: `dist/client`
   - Root directory: `/`
   - Environment variables:
     - `VITE_WS_URL` = `wss://roucraft-backend.osc-fr1.scalingo.io`

### 3. Alternative: Deploy via Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy (first time)
wrangler pages deploy dist/client --project-name roucraft

# Future deployments
wrangler pages deploy dist/client
```

## Post-Deployment

1. Update your backend's `FRONTEND_URL` environment variable with your actual Cloudflare Pages URL:
   ```bash
   scalingo --app roucraft-backend env-set FRONTEND_URL=https://roucraft.pages.dev
   ```

2. Test the deployment:
   - Visit your Cloudflare Pages URL
   - Check browser console for WebSocket connection
   - Verify multiplayer functionality

## Continuous Deployment

### For Cloudflare Pages
- Automatic deployments are set up when you connect your Git repository
- Every push to `main` branch triggers a new deployment

### For Scalingo
- Add GitHub Actions workflow:

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend to Scalingo

on:
  push:
    branches: [ main ]
    paths:
      - 'server/**'
      - 'shared/**'
      - 'package*.json'
      - 'tsconfig*.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Scalingo
        uses: scalingo/scalingo-deploy-action@v1
        with:
          api-token: ${{ secrets.SCALINGO_API_TOKEN }}
          app-name: roucraft-backend
          region: osc-fr1
```

## Troubleshooting

### WebSocket Connection Issues
- Ensure `VITE_WS_URL` is set correctly in Cloudflare Pages
- Check browser console for CORS errors
- Verify Scalingo app is running: `scalingo --app roucraft-backend ps`

### Build Failures
- Ensure all dependencies are in `dependencies`, not `devDependencies`
- Check build logs in Cloudflare Pages dashboard
- Verify TypeScript compilation: `npm run build:server`

### Performance
- Enable Cloudflare caching for static assets
- Consider upgrading Scalingo dyno size if needed
- Monitor WebSocket connections and memory usage