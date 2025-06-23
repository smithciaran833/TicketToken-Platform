import * as fs from 'fs';
import * as path from 'path';

describe('Service Files Structure', () => {
  const servicesDir = path.join(__dirname, '../src/services');

  test('should have all required service files', () => {
    const files = fs.readdirSync(servicesDir);
    
    const requiredServices = [
      'pointsEngine.ts',
      'tierManager.ts',
      'rewardsInventory.ts',
      'redemptionService.ts',
      'referralTracking.ts',
      'streakTracking.ts',
      'birthdayRewards.ts'
    ];

    requiredServices.forEach(service => {
      expect(files).toContain(service);
    });

    console.log('✅ All 7 loyalty service modules present');
  });

  test('should have substantial code in each service', () => {
    const files = fs.readdirSync(servicesDir);
    
    files.forEach(file => {
      if (file.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(servicesDir, file), 'utf8');
        const lines = content.split('\n').length;
        
        expect(lines).toBeGreaterThan(50); // Each service should be substantial
        console.log(`✅ ${file}: ${lines} lines of code`);
      }
    });
  });

  test('should export classes from each service', () => {
    const serviceFiles = [
      'pointsEngine.ts',
      'tierManager.ts',
      'rewardsInventory.ts',
      'redemptionService.ts',
      'referralTracking.ts',
      'streakTracking.ts',
      'birthdayRewards.ts'
    ];

    serviceFiles.forEach(file => {
      const content = fs.readFileSync(path.join(servicesDir, file), 'utf8');
      expect(content).toContain('export class');
      console.log(`✅ ${file} exports a class`);
    });
  });
});
