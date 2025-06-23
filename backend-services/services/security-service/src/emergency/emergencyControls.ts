interface EmergencyAction {
  id: string;
  type: 'pause_system' | 'freeze_user' | 'stop_trading';
  initiatedBy: string;
  reason: string;
  timestamp: Date;
  status: 'active' | 'resolved';
}

export class EmergencyControlSystem {
  private actions: EmergencyAction[] = [];
  private systemPaused: boolean = false;

  constructor() {
    console.log('🚨 Emergency Control System initialized');
  }

  async pauseSystem(initiatedBy: string, reason: string): Promise<string> {
    const actionId = `emergency_${Date.now()}`;
    
    this.actions.push({
      id: actionId,
      type: 'pause_system',
      initiatedBy,
      reason,
      timestamp: new Date(),
      status: 'active'
    });

    this.systemPaused = true;
    console.log(`🛑 SYSTEM PAUSED by ${initiatedBy}: ${reason}`);
    return actionId;
  }

  async restoreSystem(authorizedBy: string): Promise<boolean> {
    this.systemPaused = false;
    console.log(`✅ System restored by ${authorizedBy}`);
    return true;
  }

  isSystemOperational(): boolean {
    return !this.systemPaused;
  }
}
