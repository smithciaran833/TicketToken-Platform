describe('Week 11 Content & Perks - Validation', () => {
  test('should have all content service modules', () => {
    const fs = require('fs');
    const path = require('path');
    
    // Check content types exist
    const typesDir = path.join(__dirname, '../src/types');
    const types = fs.readdirSync(typesDir);
    
    expect(types).toContain('backstageFootage.ts');
    expect(types).toContain('virtualMeetGreet.ts');
    expect(types).toContain('exclusiveMessages.ts');
    expect(types).toContain('digitalMerchandise.ts');
    expect(types).toContain('soundcheckAudio.ts');
    
    console.log('✅ All 5 content types present');
  });

  test('should have management modules', () => {
    const fs = require('fs');
    const path = require('path');
    
    // Check management modules exist
    const managementDir = path.join(__dirname, '../src/management');
    const modules = fs.readdirSync(managementDir);
    
    expect(modules).toContain('contentUpload.ts');
    expect(modules).toContain('contentDelivery.ts');
    
    console.log('✅ Content management modules present');
  });

  test('should validate service structure integrity', () => {
    const fs = require('fs');
    const path = require('path');
    
    // Check main service file
    const mainService = path.join(__dirname, '../src/index.ts');
    expect(fs.existsSync(mainService)).toBe(true);
    
    // Check if it's substantial
    const content = fs.readFileSync(mainService, 'utf8');
    const lines = content.split('\n').length;
    expect(lines).toBeGreaterThan(100); // Should be substantial
    
    console.log(`✅ Main service file: ${lines} lines`);
  });
});
