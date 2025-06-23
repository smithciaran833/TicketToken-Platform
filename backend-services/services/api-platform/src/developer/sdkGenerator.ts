import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

interface SDKConfig {
  language: 'javascript' | 'python' | 'php' | 'ruby' | 'go';
  version: string;
  baseUrl: string;
  apiKey: string;
  tenantId: string;
}

interface EndpointDefinition {
  method: string;
  path: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  response: {
    type: string;
    example: any;
  };
}

export class SDKGenerator {
  private endpoints: EndpointDefinition[] = [];

  constructor() {
    console.log('📚 SDKGenerator initialized');
    this.loadEndpoints();
  }

  private loadEndpoints(): void {
    // Define all API endpoints
    this.endpoints = [
      {
        method: 'POST',
        path: '/events',
        description: 'Create a new event',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Event name' },
          { name: 'date', type: 'string', required: true, description: 'Event date (ISO 8601)' },
          { name: 'venue', type: 'string', required: true, description: 'Venue name' },
          { name: 'capacity', type: 'number', required: true, description: 'Total capacity' }
        ],
        response: {
          type: 'Event',
          example: { id: 'evt_abc123', name: 'Concert Night', status: 'active' }
        }
      },
      {
        method: 'POST',
        path: '/tickets/mint',
        description: 'Mint tickets for an event',
        parameters: [
          { name: 'eventId', type: 'string', required: true, description: 'Event ID' },
          { name: 'quantity', type: 'number', required: true, description: 'Number of tickets' },
          { name: 'tier', type: 'string', required: false, description: 'Ticket tier' }
        ],
        response: {
          type: 'TicketBatch',
          example: { batchId: 'batch_xyz789', tickets: ['ticket_1', 'ticket_2'] }
        }
      },
      {
        method: 'GET',
        path: '/analytics/sales',
        description: 'Get sales analytics',
        parameters: [
          { name: 'startDate', type: 'string', required: false, description: 'Start date filter' },
          { name: 'endDate', type: 'string', required: false, description: 'End date filter' }
        ],
        response: {
          type: 'SalesData',
          example: { totalRevenue: 50000, ticketsSold: 1250, averagePrice: 40 }
        }
      }
    ];
  }

  async generateJavaScriptSDK(config: SDKConfig): Promise<string> {
    const template = `
/**
 * TicketToken JavaScript SDK v{{version}}
 * Official SDK for TicketToken API
 */

class TicketTokenClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || '{{baseUrl}}';
    this.tenantId = options.tenantId || '{{tenantId}}';
  }

  async request(method, endpoint, data = null) {
    const url = \`\${this.baseUrl}\${endpoint}\`;
    const options = {
      method: method.toUpperCase(),
      headers: {
        'Authorization': \`Bearer \${this.apiKey}\`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': this.tenantId
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'API request failed');
      }
      
      return result;
    } catch (error) {
      throw new Error(\`TicketToken API Error: \${error.message}\`);
    }
  }

{{#each endpoints}}
  /**
   * {{description}}
   {{#each parameters}}
   * @param {{{type}}} {{name}} - {{description}}{{#if required}} (required){{/if}}
   {{/each}}
   * @returns {Promise<{{response.type}}>}
   */
  async {{#if (eq method "POST")}}create{{else}}get{{/if}}{{pascalCase path}}({{#each parameters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}) {
    {{#if (eq method "POST")}}
    const data = { {{#each parameters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}} };
    return await this.request('{{method}}', '{{path}}', data);
    {{else}}
    const params = new URLSearchParams({ {{#each parameters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}} });
    return await this.request('{{method}}', \`{{path}}?\${params}\`);
    {{/if}}
  }

{{/each}}
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TicketTokenClient;
}

// Browser global
if (typeof window !== 'undefined') {
  window.TicketTokenClient = TicketTokenClient;
}
`;

    const compiled = Handlebars.compile(template);
    return compiled({ ...config, endpoints: this.endpoints });
  }

  async generatePythonSDK(config: SDKConfig): Promise<string> {
    const template = `
"""
TicketToken Python SDK v{{version}}
Official Python SDK for TicketToken API
"""

import requests
import json
from typing import Dict, Any, Optional

class TicketTokenClient:
    """Official TicketToken API client for Python"""
    
    def __init__(self, api_key: str, base_url: str = "{{baseUrl}}", tenant_id: str = "{{tenantId}}"):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.tenant_id = tenant_id
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenant_id
        })
    
    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request to API"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=data)
            else:
                response = self.session.request(method.upper(), url, json=data)
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"TicketToken API Error: {str(e)}")

{{#each endpoints}}
    def {{snakeCase path}}_{{lowercase method}}(self{{#each parameters}}, {{snake_case name}}: {{pythonType type}}{{#unless required}} = None{{/unless}}{{/each}}) -> Dict[str, Any]:
        """
        {{description}}
        
        Args:
        {{#each parameters}}
            {{snake_case name}} ({{pythonType type}}): {{description}}{{#if required}} (required){{/if}}
        {{/each}}
        
        Returns:
            Dict[str, Any]: {{response.type}} object
        """
        {{#if (eq method "POST")}}
        data = { {{#each parameters}}'{{name}}': {{snake_case name}}{{#unless @last}}, {{/unless}}{{/each}} }
        return self._request('{{method}}', '{{path}}', data)
        {{else}}
        params = { {{#each parameters}}'{{name}}': {{snake_case name}}{{#unless @last}}, {{/unless}}{{/each}} }
        return self._request('{{method}}', '{{path}}', params)
        {{/if}}

{{/each}}
`;

    const compiled = Handlebars.compile(template);
    return compiled({ ...config, endpoints: this.endpoints });
  }

  async generateDocumentation(config: SDKConfig): Promise<string> {
    const template = `
# TicketToken API Documentation

## Getting Started

### Installation

#### JavaScript/Node.js
\`\`\`bash
npm install @tickettoken/sdk
\`\`\`

#### Python
\`\`\`bash
pip install tickettoken-sdk
\`\`\`

### Authentication

All API requests require authentication using your API key:

\`\`\`javascript
const client = new TicketTokenClient('{{apiKey}}', {
  tenantId: '{{tenantId}}'
});
\`\`\`

\`\`\`python
from tickettoken import TicketTokenClient

client = TicketTokenClient('{{apiKey}}', tenant_id='{{tenantId}}')
\`\`\`

## API Reference

{{#each endpoints}}
### {{method}} {{path}}

{{description}}

**Parameters:**
{{#each parameters}}
- \`{{name}}\` ({{type}}){{#if required}} **required**{{/if}} - {{description}}
{{/each}}

**Response:**
\`\`\`json
{{json response.example}}
\`\`\`

**Example:**

JavaScript:
\`\`\`javascript
{{#if (eq method "POST")}}
const result = await client.create{{pascalCase path}}({{#each parameters}}'{{name}}_value'{{#unless @last}}, {{/unless}}{{/each}});
{{else}}
const result = await client.get{{pascalCase path}}({{#each parameters}}'{{name}}_value'{{#unless @last}}, {{/unless}}{{/each}});
{{/if}}
console.log(result);
\`\`\`

Python:
\`\`\`python
{{#if (eq method "POST")}}
result = client.{{snakeCase path}}_post({{#each parameters}}{{snake_case name}}='{{name}}_value'{{#unless @last}}, {{/unless}}{{/each}})
{{else}}
result = client.{{snakeCase path}}_get({{#each parameters}}{{snake_case name}}='{{name}}_value'{{#unless @last}}, {{/unless}}{{/each}})
{{/if}}
print(result)
\`\`\`

---

{{/each}}

## Error Handling

The SDK throws exceptions for API errors:

\`\`\`javascript
try {
  const result = await client.createEvent(eventData);
} catch (error) {
  console.error('API Error:', error.message);
}
\`\`\`

\`\`\`python
try:
    result = client.events_post(event_data)
except Exception as e:
    print(f"API Error: {e}")
\`\`\`

## Rate Limits

- Test API keys: 1,000 requests/hour
- Live API keys: 10,000 requests/hour

## Support

- Documentation: https://docs.tickettoken.io
- Support: support@tickettoken.io
- Status: https://status.tickettoken.io
`;

    const compiled = Handlebars.compile(template);
    return compiled({ ...config, endpoints: this.endpoints });
  }

  async generateAllSDKs(config: SDKConfig): Promise<{[key: string]: string}> {
    console.log(`📚 Generating SDKs for tenant: ${config.tenantId}`);
    
    const sdks = {
      'javascript': await this.generateJavaScriptSDK(config),
      'python': await this.generatePythonSDK(config),
      'documentation': await this.generateDocumentation(config)
    };

    console.log(`✅ Generated ${Object.keys(sdks).length} SDK packages`);
    return sdks;
  }
}

// Helper functions for Handlebars
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('json', obj => JSON.stringify(obj, null, 2));
Handlebars.registerHelper('pascalCase', str => str.replace(/\//g, '').replace(/\b\w/g, l => l.toUpperCase()));
Handlebars.registerHelper('snakeCase', str => str.toLowerCase().replace(/\//g, '_').replace(/[^a-z0-9_]/g, '_'));
Handlebars.registerHelper('lowercase', str => str.toLowerCase());
Handlebars.registerHelper('pythonType', type => {
  const typeMap = { 'string': 'str', 'number': 'int', 'boolean': 'bool' };
  return typeMap[type] || 'Any';
});
