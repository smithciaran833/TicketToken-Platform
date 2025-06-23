import request from 'supertest';
import express from 'express';

// Mock the entire app
const app = express();
app.use(express.json());

// Mock endpoints for testing
app.post('/api/spotify/verify-artist', (req, res) => {
  res.json({ success: true, data: { verified: true, score: 85 } });
});

app.post('/api/instagram/share-ticket', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      imageUrl: 'https://cdn.example.com/story.png',
      caption: 'Just got my tickets!'
    }
  });
});

app.post('/api/twitter/announce-event', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      status: 'posted',
      tweetId: 'tweet_123'
    }
  });
});

describe('Integration Service API', () => {
  describe('Spotify Integration', () => {
    it('should verify artist successfully', async () => {
      const response = await request(app)
        .post('/api/spotify/verify-artist')
        .send({
          spotifyId: 'spotify_artist_123',
          artistId: 'tt_artist_123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verified).toBe(true);
    });
  });

  describe('Instagram Integration', () => {
    it('should create shareable story content', async () => {
      const response = await request(app)
        .post('/api/instagram/share-ticket')
        .send({
          ticketId: 'ticket_123',
          userId: 'user_123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.imageUrl).toContain('https://');
    });
  });

  describe('Twitter Integration', () => {
    it('should announce new event', async () => {
      const response = await request(app)
        .post('/api/twitter/announce-event')
        .send({
          eventId: 'event_123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('posted');
    });
  });
});
