export class RedisService {
  private storage = new Map<string, string>();

  async set(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async del(key: string): Promise<void> {
    this.storage.delete(key);
  }
}
