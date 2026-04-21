# Chatbot Setup - Secure API Configuration

## Overview

Your chatbot is now configured to use a **backend proxy** for the Google Gemini API. This keeps your API key **secure on the server** and never exposes it to the browser.

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

This installs `express`, `axios`, and `cors` required for the backend server.

### 2. Configure Your API Key

The `.env` file has already been created with your API key. 

**⚠️ IMPORTANT:** Never commit `.env` to GitHub!
- `.env` is already in `.gitignore`
- This file is for **local development only**

### 3. Run the Server

```bash
node server-chatbot.js
```

You should see:
```
✅ Chatbot server is running on http://localhost:3000
📚 Access chatbot at http://localhost:3000
🔑 API Key configured: Yes (from .env)
```

### 4. Open Chatbot

Visit `http://localhost:3000` in your browser

## How It Works

1. **Frontend (chatbot/script.js)**: Browser sends chat request to `/api/chat`
2. **Backend (server-chatbot.js)**: Server receives request, adds API key, calls Google API
3. **Google API**: Returns response to backend
4. **Backend**: Sends response back to frontend
5. **Frontend**: Displays response to user

**Result:** Your API key is **never exposed** to the browser!

## File Structure

```
.env                      ← Your API key (LOCAL ONLY, never commit)
.env.example             ← Template for .env (safe to commit)
.gitignore              ← Includes .env (prevents accidental commits)
server-chatbot.js       ← Backend proxy server
chatbot/
  ├── script.js         ← Updated to use /api/chat endpoint
  ├── index.html
  └── style.css
```

## Security Notes

✅ **What's Secure:**
- API key is on the server, not in the browser
- `.env` is not committed to GitHub
- Only your server calls Google API

⚠️ **Before You Push to GitHub:**
1. Make sure `.env` is NOT in your repository
2. Only `.env.example` should be in GitHub
3. Never hardcode secrets in code files

## Deployment (Optional)

When deploying to a server (Vercel, Heroku, etc.):

1. **Don't include `.env` in upload**
2. **Set environment variables on the hosting platform:**
   - Heroku: `heroku config:set GOOGLE_API_KEY=your_key`
   - Vercel: Settings → Environment Variables → add `GOOGLE_API_KEY`
   - Railway/Render: Same approach

## Troubleshooting

**Error: "API key not configured"**
- Check if `.env` exists in your project root
- Check if `GOOGLE_API_KEY=your_key` is in `.env`

**CORS error in browser**
- Make sure you're visiting `http://localhost:3000` (not `localhost`)
- Check if the server is running

**API quota exceeded**
- Set monthly quota limit in Google Cloud Console
- Revoke and regenerate your API key if already leaked
