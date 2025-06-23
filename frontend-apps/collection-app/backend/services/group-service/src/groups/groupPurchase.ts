export interface Group {
  id: string;
  name: string;
  description: string;
  maxMembers: number;
  currentMembers: number;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}

export interface GroupPurchase {
  id: string;
  groupId: string;
  ticketId: string;
  quantity: number;
  pricePerTicket: number;
  totalCost: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
}

export class GroupPurchaseService {
  private groups: Map<string, Group> = new Map();
  private purchases: Map<string, GroupPurchase> = new Map();

  async createGroup(groupData: Omit<Group, 'id' | 'createdAt' | 'currentMembers'>): Promise<Group> {
    const group: Group = {
      ...groupData,
      id: this.generateId(),
      currentMembers: 1,
      createdAt: new Date()
    };

    this.groups.set(group.id, group);
    return group;
  }

  async joinGroup(groupId: string, userId: string): Promise<boolean> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.currentMembers >= group.maxMembers) {
      return false;
    }

    group.currentMembers += 1;
    this.groups.set(groupId, group);
    return true;
  }

  async createPurchase(purchaseData: Omit<GroupPurchase, 'id' | 'createdAt' | 'totalCost'>): Promise<GroupPurchase> {
    const purchase: GroupPurchase = {
      ...purchaseData,
      id: this.generateId(),
      totalCost: purchaseData.quantity * purchaseData.pricePerTicket,
      createdAt: new Date()
    };

    this.purchases.set(purchase.id, purchase);
    return purchase;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  async getGroup(groupId: string): Promise<Group | undefined> {
    return this.groups.get(groupId);
  }

  async getAllGroups(): Promise<Group[]> {
    return Array.from(this.groups.values());
  }

  async getPurchase(purchaseId: string): Promise<GroupPurchase | undefined> {
    return this.purchases.get(purchaseId);
  }

  async getGroupPurchases(groupId: string): Promise<GroupPurchase[]> {
    return Array.from(this.purchases.values()).filter(p => p.groupId === groupId);
  }
}
