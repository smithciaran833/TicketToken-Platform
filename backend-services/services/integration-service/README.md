# TicketToken Social Media Integration Service

This service handles all social media integrations for the TicketToken platform, including Spotify, Instagram, and Twitter.

## Features

### Spotify Integration
- Artist verification via follower count and popularity
- Fan music preference analysis
- Event recommendations based on listening history
- Playlist creation for events

### Instagram Integration
- Automatic story generation for ticket purchases
- Event promotion campaigns
- Influencer tracking and ROI measurement
- Viral content identification

### Twitter Integration
- Automated event announcements
- Social proof tracking
- Viral hashtag monitoring
- Real-time engagement metrics

## Setup

1. **Install dependencies:**
   ```bash
   cd backend/services/integration-service
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Fill in your API credentials
   ```

3. **API Credentials Required:**

   **Spotify:**
   - Create app at https://developer.spotify.com/
   - Get Client ID and Client Secret

   **Twitter:**
   - Apply for API access at https://developer.twitter.com/
   - Get API Key, API Secret, Access Token, Access Secret

   **Instagram:**
   - Create Facebook App with Instagram Basic Display
   - Get App ID and App Secret

4. **Start the service:**
   ```bash
   npm run dev
   ```

## API Endpoints

### Spotify
- `POST /api/spotify/verify-artist` - Verify artist authenticity
- `POST /api/spotify/connect-fan` - Connect fan's Spotify account

### Instagram  
- `POST /api/instagram/share-ticket` - Generate shareable story
- `POST /api/instagram/create-campaign` - Create promotion campaign

### Twitter
- `POST /api/twitter/announce-event` - Announce new event
- `GET /api/twitter/viral-metrics/:eventId` - Get viral tracking data

## Environment Variables

```env
# Spotify
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# Twitter
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

# Instagram
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret

# Infrastructure
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_URL=postgresql://...
CDN_URL=https://cdn.tickettoken.io
```

## Testing

Run the test suite:
```bash
npm test
```

## Deployment

Build for production:
```bash
npm run build
npm start
```

## Monitoring

The service includes built-in monitoring and logging. Check the logs for:
- API rate limit status
- Social media engagement metrics
- Viral event detection
- Error tracking

## Rate Limits

Each platform has different rate limits:
- **Spotify:** 100 requests per minute
- **Twitter:** 300 requests per 15 minutes
- **Instagram:** 200 requests per hour

The service automatically handles rate limiting and queuing.
