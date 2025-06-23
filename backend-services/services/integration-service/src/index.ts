import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Import services
import { SpotifyArtistVerifier } from './social/spotify/artistVerification';
import { SpotifyFanConnector } from './social/spotify/fanConnection';
import { InstagramStorySharer } from './social/instagram/storySharing';
import { InstagramEventPromoter } from './social/instagram/eventPromotion';
import { TwitterEventAnnouncer } from './social/twitter/eventAnnouncements';
import { TwitterViralTracker } from './social/twitter/viralTracking';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'integration-service', timestamp: new Date() });
});

// Initialize services
const spotifyVerifier = new SpotifyArtistVerifier();
const spotifyConnector = new SpotifyFanConnector();
const instagramSharer = new InstagramStorySharer();
const instagramPromoter = new InstagramEventPromoter();
const twitterAnnouncer = new TwitterEventAnnouncer();
const twitterTracker = new TwitterViralTracker();

// Spotify routes
app.post('/api/spotify/verify-artist', async (req, res) => {
  try {
    const { spotifyId, artistId } = req.body;
    const result = await spotifyVerifier.verifyArtist(spotifyId, artistId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/spotify/connect-fan', async (req, res) => {
  try {
    const { userId, accessToken } = req.body;
    const result = await spotifyConnector.linkFanAccount(userId, accessToken);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Instagram routes
app.post('/api/instagram/share-ticket', async (req, res) => {
  try {
    const { ticketId, userId, accessToken } = req.body;
    const result = await instagramSharer.shareTicketPurchase(ticketId, userId, accessToken);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/instagram/create-campaign', async (req, res) => {
  try {
    const { eventId, type } = req.body;
    const result = await instagramPromoter.createPromotionCampaign(eventId, type);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Twitter routes
app.post('/api/twitter/announce-event', async (req, res) => {
  try {
    const { eventId } = req.body;
    const result = await twitterAnnouncer.announceNewEvent(eventId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/twitter/viral-metrics/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await twitterTracker.trackEventVirality(eventId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scheduled jobs
setInterval(async () => {
  console.log('Processing pending tweets...');
  await twitterAnnouncer.processPendingTweets();
}, 60000); // Every minute

app.listen(PORT, () => {
  console.log(`🚀 Integration service running on port ${PORT}`);
  console.log('📱 Social media integrations active');
  console.log('🔗 Spotify, Instagram, and Twitter connected');
});

// Marketing integrations
import { MailchimpIntegration } from './marketing/email/mailchimpSync';
import { EmailCampaignTracker } from './marketing/email/campaignTracking';
import { GoogleAnalyticsIntegration } from './marketing/analytics/googleAnalytics';
import { MarketingAutomationEngine } from './marketing/automation/automatedFlows';

// Business integrations
import { SalesforceIntegration } from './business/crm/salesforceSync';
import { QuickBooksIntegration } from './business/accounting/quickbooksIntegration';

// Initialize additional services
const mailchimp = new MailchimpIntegration();
const emailTracker = new EmailCampaignTracker();
const googleAnalytics = new GoogleAnalyticsIntegration();
const automationEngine = new MarketingAutomationEngine();
const salesforce = new SalesforceIntegration();
const quickbooks = new QuickBooksIntegration();

// Marketing routes
app.post('/api/mailchimp/sync-event', async (req, res) => {
  try {
    const { eventId } = req.body;
    const result = await mailchimp.syncEventTicketHolders(eventId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/email-campaigns/:campaignId/metrics', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { platform = 'mailchimp' } = req.query;
    const result = await emailTracker.trackCampaignROI(campaignId, platform as string);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analytics/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { startDate, endDate } = req.query;
    const result = await googleAnalytics.trackEventPerformance(
      eventId, 
      startDate as string, 
      endDate as string
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Business integration routes
app.post('/api/salesforce/sync-venue', async (req, res) => {
  try {
    const { venueId } = req.body;
    const result = await salesforce.syncVenueData(venueId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/salesforce/sync-artist', async (req, res) => {
  try {
    const { artistId } = req.body;
    const result = await salesforce.syncArtistData(artistId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/quickbooks/sync-venue', async (req, res) => {
  try {
    const { venueId } = req.body;
    const result = await quickbooks.syncVenueFinancials(venueId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/quickbooks/reports/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const result = await quickbooks.generateFinancialReports(startDate, endDate);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Automation routes
app.post('/api/automation/trigger', async (req, res) => {
  try {
    const { triggerType, eventData } = req.body;
    await automationEngine.triggerWorkflow(triggerType, eventData);
    res.json({ success: true, message: 'Workflow triggered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/automation/analytics/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { days = 30 } = req.query;
    const result = await automationEngine.getWorkflowAnalytics(workflowId, Number(days));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize default automation workflows
automationEngine.setupDefaultWorkflows().catch(console.error);

console.log('📧 Email marketing integrations active');
console.log('📊 Analytics tracking enabled');
console.log('🏢 CRM and accounting sync ready');
console.log('🔄 Marketing automation workflows initialized');
