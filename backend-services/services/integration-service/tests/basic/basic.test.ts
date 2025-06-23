describe('Basic Test Suite', () => {
  it('should verify testing framework works', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  it('should verify object matching', () => {
    const testObject = {
      platform: 'spotify',
      verified: true,
      score: 85
    };

    expect(testObject).toMatchObject({
      platform: 'spotify',
      verified: true
    });
  });
});
