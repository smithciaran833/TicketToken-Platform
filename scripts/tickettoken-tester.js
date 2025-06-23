// Node.js TicketToken Month 1 Load Tester
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    baseURL: process.env.BACKEND_URL || 'http://localhost:3000',
    testTimeout: 5000
};

class TicketTokenTester {
    constructor() {
        this.resultsDir = `./test-results-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}`;
        this.setupResultsDir();
    }

    setupResultsDir() {
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const colors = {
            INFO: '\x1b[36m',
            SUCCESS: '\x1b[32m', 
            ERROR: '\x1b[31m',
            WARNING: '\x1b[33m',
            RESET: '\x1b[0m'
        };
        
        console.log(`${colors[type]}[${type}]${colors.RESET} ${message}`);
        
        // Save to file
        fs.appendFileSync(
            path.join(this.resultsDir, 'test-log.txt'),
            `${timestamp} [${type}] ${message}\n`
        );
    }

    async safeRequest(method, url, data = null) {
        try {
            const config = {
                method,
                url: `${CONFIG.baseURL}${url}`,
                timeout: CONFIG.testTimeout,
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (data) config.data = data;
            
            const response = await axios(config);
            return { success: true, data: response.data, status: response.status };
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return { success: false, error: 'SERVICE_DOWN', message: 'Backend not running' };
            }
            return { 
                success: false, 
                error: error.code || 'UNKNOWN',
                message: error.message,
                status: error.response?.status 
            };
        }
    }

    async checkServices() {
        this.log('🔍 Checking if services are running...');
        
        const healthCheck = await this.safeRequest('GET', '/health');
        
        if (!healthCheck.success) {
            this.log(`❌ Backend not accessible at ${CONFIG.baseURL}`, 'ERROR');
            
            // Check other common ports
            this.log('🔍 Scanning for services on other ports...', 'INFO');
            const ports = [3000, 3001, 3002, 3003, 4000, 5000, 8000, 8080];
            
            for (const port of ports) {
                try {
                    const testResponse = await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
                    this.log(`✅ Found service on port ${port}`, 'SUCCESS');
                    this.log(`💡 Try: export BACKEND_URL="http://localhost:${port}"`, 'INFO');
                } catch (e) {
                    // Silent failure
                }
            }
            
            return false;
        }
        
        this.log('✅ Backend is accessible and healthy', 'SUCCESS');
        return true;
    }

    async testBasicEndpoints() {
        this.log('📋 Testing basic API endpoints...');
        
        const endpoints = [
            { path: '/health', name: 'Health Check' },
            { path: '/api/events', name: 'Events API' },
            { path: '/api/tickets', name: 'Tickets API' },
            { path: '/api/users', name: 'Users API' },
            { path: '/api/payments', name: 'Payments API' }
        ];
        
        let successCount = 0;
        
        for (const endpoint of endpoints) {
            const start = Date.now();
            const result = await this.safeRequest('GET', endpoint.path);
            const duration = Date.now() - start;
            
            if (result.success || (result.status && result.status < 500)) {
                this.log(`✅ ${endpoint.name} (${duration}ms)`, 'SUCCESS');
                successCount++;
            } else {
                this.log(`❌ ${endpoint.name} failed: ${result.message}`, 'ERROR');
            }
        }
        
        this.log(`📊 Endpoint test results: ${successCount}/${endpoints.length} successful`, 'INFO');
        return successCount;
    }

    async testEventCreation() {
        this.log('🎫 Testing event creation...');
        
        const eventData = {
            name: 'Load Test Event',
            description: 'Test event for load testing',
            venue: 'Test Venue',
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            capacity: 100,
            price: 50.00,
            artist: 'Test Artist'
        };
        
        const start = Date.now();
        const result = await this.safeRequest('POST', '/api/events', eventData);
        const duration = Date.now() - start;
        
        if (result.success) {
            this.log(`✅ Event created successfully (${duration}ms)`, 'SUCCESS');
            
            // Save event details
            fs.writeFileSync(
                path.join(this.resultsDir, 'created-event.json'),
                JSON.stringify({ eventData, response: result.data, duration }, null, 2)
            );
            
            return result.data;
        } else {
            this.log(`❌ Event creation failed: ${result.message}`, 'ERROR');
            return null;
        }
    }

    async testConcurrentRequests(count = 5) {
        this.log(`🚀 Testing ${count} concurrent requests...`);
        
        const start = Date.now();
        const promises = [];
        
        for (let i = 0; i < count; i++) {
            promises.push(this.safeRequest('GET', '/health'));
        }
        
        try {
            const results = await Promise.all(promises);
            const totalDuration = Date.now() - start;
            const successCount = results.filter(r => r.success).length;
            
            this.log(`✅ Concurrent test: ${successCount}/${count} succeeded in ${totalDuration}ms`, 'SUCCESS');
            
            // Save results
            fs.writeFileSync(
                path.join(this.resultsDir, 'concurrent-test.json'),
                JSON.stringify({ count, results, totalDuration }, null, 2)
            );
            
            return successCount;
        } catch (error) {
            this.log(`❌ Concurrent test failed: ${error.message}`, 'ERROR');
            return 0;
        }
    }

    async runFullTest() {
        this.log('🚀 Starting TicketToken Month 1 Load Test');
        this.log(`Backend URL: ${CONFIG.baseURL}`);
        this.log(`Results will be saved to: ${this.resultsDir}`);
        
        let testsPassed = 0;
        let totalTests = 0;
        
        try {
            // Test 1: Service Check
            totalTests++;
            const servicesRunning = await this.checkServices();
            if (servicesRunning) testsPassed++;
            
            if (!servicesRunning) {
                this.log('❌ Cannot proceed - services not running', 'ERROR');
                this.log('💡 Start your TicketToken backend and try again', 'INFO');
                this.log('Common commands:', 'INFO');
                this.log('  • npm start', 'INFO');
                this.log('  • docker-compose up -d', 'INFO');
                this.log('  • cd backend && npm run dev', 'INFO');
                return;
            }
            
            // Test 2: Basic Endpoints
            totalTests++;
            const endpointResults = await this.testBasicEndpoints();
            if (endpointResults > 0) testsPassed++;
            
            // Test 3: Event Creation
            totalTests++;
            const event = await this.testEventCreation();
            if (event) testsPassed++;
            
            // Test 4: Concurrent Requests
            totalTests++;
            const concurrentResults = await this.testConcurrentRequests(5);
            if (concurrentResults > 0) testsPassed++;
            
            // Final Results
            this.log('📊 FINAL RESULTS', 'INFO');
            this.log(`Tests Passed: ${testsPassed}/${totalTests}`, 'INFO');
            this.log(`Success Rate: ${Math.round(testsPassed/totalTests*100)}%`, 'INFO');
            this.log(`Results saved to: ${this.resultsDir}`, 'INFO');
            
            if (testsPassed === totalTests) {
                this.log('🎉 All tests passed! Your Month 1 system is working!', 'SUCCESS');
            } else {
                this.log('⚠️ Some tests failed. Check the logs for details.', 'WARNING');
            }
            
        } catch (error) {
            this.log(`❌ Test suite failed: ${error.message}`, 'ERROR');
            console.error(error);
        }
    }
}

// Run the test suite
const tester = new TicketTokenTester();
tester.runFullTest();
