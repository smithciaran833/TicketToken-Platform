import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface SyncData {
  tickets: any[];
  events: any[];
  validations: any[];
  lastSync: number;
}

interface QueuedAction {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

export class SyncManager {
  private isOnline: boolean = true;
  private syncQueue: QueuedAction[] = [];
  private syncInProgress: boolean = false;

  constructor() {
    this.setupNetworkListener();
    this.loadSyncQueue();
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOffline && this.isOnline) {
        console.log('📡 Connection restored, starting sync...');
        this.performFullSync();
      } else if (!this.isOnline) {
        console.log('📡 Connection lost, switching to offline mode...');
      }
    });
  }

  async storeOfflineData(key: string, data: any): Promise<void> {
    try {
      const timestamp = Date.now();
      const offlineData = {
        data,
        timestamp,
        synced: false
      };
      
      await AsyncStorage.setItem(
        `offline_${key}`,
        JSON.stringify(offlineData)
      );
      
      console.log(`💾 Stored offline: ${key}`);
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }

  async getOfflineData(key: string): Promise<any> {
    try {
      const stored = await AsyncStorage.getItem(`offline_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get offline data:', error);
      return null;
    }
  }

  async queueAction(type: string, data: any): Promise<void> {
    const action: QueuedAction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    if (this.isOnline) {
      // Execute immediately if online
      try {
        await this.executeAction(action);
        console.log(`✅ Executed action: ${type}`);
      } catch (error) {
        console.log(`❌ Action failed, queuing: ${type}`);
        this.syncQueue.push(action);
        await this.saveSyncQueue();
      }
    } else {
      // Queue for later if offline
      this.syncQueue.push(action);
      await this.saveSyncQueue();
      console.log(`📋 Queued action: ${type}`);
    }
  }

  async performFullSync(): Promise<void> {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    console.log('🔄 Starting full sync...');
    
    try {
      // 1. Process queued actions
      await this.processQueue();
      
      // 2. Sync local data with server
      await this.syncLocalData();
      
      // 3. Download latest data
      await this.downloadLatestData();
      
      console.log('✅ Full sync completed');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    console.log(`📋 Processing ${this.syncQueue.length} queued actions...`);
    
    const actionsToProcess = [...this.syncQueue];
    this.syncQueue = [];

    for (const action of actionsToProcess) {
      try {
        await this.executeAction(action);
        console.log(`✅ Processed queued action: ${action.type}`);
      } catch (error) {
        console.error(`❌ Failed to process action: ${action.type}`, error);
        
        // Retry logic
        action.retryCount++;
        if (action.retryCount < 3) {
          this.syncQueue.push(action);
        } else {
          console.log(`🗑️ Discarding action after 3 retries: ${action.type}`);
        }
      }
    }

    await this.saveSyncQueue();
  }

  private async syncLocalData(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const offlineKeys = keys.filter(key => key.startsWith('offline_'));
    
    for (const key of offlineKeys) {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const { data, timestamp, synced } = JSON.parse(stored);
          
          if (!synced) {
            await this.uploadToServer(key.replace('offline_', ''), data);
            
            // Mark as synced
            await AsyncStorage.setItem(key, JSON.stringify({
              data,
              timestamp,
              synced: true
            }));
          }
        }
      } catch (error) {
        console.error(`Failed to sync ${key}:`, error);
      }
    }
  }

  private async downloadLatestData(): Promise<void> {
    try {
      // Download latest events
      const events = await this.fetchFromAPI('/api/events');
      await this.storeOfflineData('events', events);

      // Download user tickets
      const tickets = await this.fetchFromAPI('/api/user/tickets');
      await this.storeOfflineData('tickets', tickets);

      console.log('📥 Downloaded latest data');
    } catch (error) {
      console.error('Failed to download latest data:', error);
    }
  }

  private async executeAction(action: QueuedAction): Promise<void> {
    // Execute API calls based on action type
    switch (action.type) {
      case 'VALIDATE_TICKET':
        await this.fetchFromAPI('/api/tickets/validate', {
          method: 'POST',
          body: JSON.stringify(action.data)
        });
        break;
      case 'UPDATE_ATTENDANCE':
        await this.fetchFromAPI('/api/events/attendance', {
          method: 'PUT',
          body: JSON.stringify(action.data)
        });
        break;
      case 'PURCHASE_TICKET':
        await this.fetchFromAPI('/api/tickets/purchase', {
          method: 'POST',
          body: JSON.stringify(action.data)
        });
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async uploadToServer(type: string, data: any): Promise<void> {
    const endpoint = this.getUploadEndpoint(type);
    await this.fetchFromAPI(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  private getUploadEndpoint(type: string): string {
    const endpoints: Record<string, string> = {
      'validations': '/api/tickets/validations',
      'analytics': '/api/analytics/events',
      'user_data': '/api/user/sync'
    };
    return endpoints[type] || '/api/sync';
  }

  private async fetchFromAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
    const baseURL = 'https://api.tickettoken.io';
    const response = await fetch(`${baseURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('sync_queue');
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  getNetworkStatus(): boolean {
    return this.isOnline;
  }

  getQueueSize(): number {
    return this.syncQueue.length;
  }

  async clearOfflineData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key => key.startsWith('offline_'));
      await AsyncStorage.multiRemove(offlineKeys);
      console.log('🗑️ Cleared offline data');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }
}
