import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';

interface BrandingConfig {
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  font: string;
  favicon: string;
}

export default function BrandingPage() {
  const [config, setConfig] = useState<BrandingConfig>({
    logo: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    accentColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    font: 'Inter',
    favicon: ''
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fontOptions = [
    'Inter',
    'Roboto',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Poppins',
    'Source Sans Pro',
    'Nunito Sans'
  ];

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setConfig(prev => ({ ...prev, logo: previewUrl }));
    }
  };

  const generatePreview = async () => {
    setIsGenerating(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      window.open('https://preview.tickettoken.io/demo', '_blank');
    } catch (error) {
      console.error('Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Branding configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="px-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Brand Configuration</h1>
              <p className="text-gray-600">Customize your platform's appearance and branding</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={generatePreview}
                disabled={isGenerating}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : '👀 Preview'}
              </button>
              <button
                onClick={saveConfiguration}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Brand Settings</h2>
            
            <div className="space-y-6">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Logo
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {config.logo ? (
                    <div className="space-y-3">
                      <img src={config.logo} alt="Logo" className="mx-auto h-16 w-auto" />
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, logo: '' }))}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove Logo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">🖼️</div>
                      <p className="text-sm text-gray-600 mb-3">Upload your company logo</p>
                      <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Color Configuration */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-gray-900">Color Scheme</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <ColorInput
                    label="Primary Color"
                    value={config.primaryColor}
                    onChange={(value) => setConfig(prev => ({ ...prev, primaryColor: value }))}
                  />
                  <ColorInput
                    label="Secondary Color"
                    value={config.secondaryColor}
                    onChange={(value) => setConfig(prev => ({ ...prev, secondaryColor: value }))}
                  />
                  <ColorInput
                    label="Accent Color"
                    value={config.accentColor}
                    onChange={(value) => setConfig(prev => ({ ...prev, accentColor: value }))}
                  />
                  <ColorInput
                    label="Background"
                    value={config.backgroundColor}
                    onChange={(value) => setConfig(prev => ({ ...prev, backgroundColor: value }))}
                  />
                </div>
              </div>

              {/* Typography */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Font Family
                </label>
                <select
                  value={config.font}
                  onChange={(e) => setConfig(prev => ({ ...prev, font: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {fontOptions.map(font => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="bg-gray-100 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Live Preview</h2>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <LivePreview config={config} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ColorInput({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="flex items-center space-x-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>
    </div>
  );
}

function LivePreview({ config }: { config: BrandingConfig }) {
  return (
    <div style={{ fontFamily: config.font, backgroundColor: config.backgroundColor }}>
      {/* Header */}
      <div style={{ backgroundColor: config.primaryColor, color: 'white' }} className="p-4">
        <div className="flex items-center justify-between">
          {config.logo ? (
            <img src={config.logo} alt="Logo" className="h-8 w-auto" />
          ) : (
            <div className="text-lg font-bold">Your Company</div>
          )}
          <nav className="flex space-x-4 text-sm">
            <a href="#" className="text-white hover:opacity-80">Events</a>
            <a href="#" className="text-white hover:opacity-80">Artists</a>
            <a href="#" className="text-white hover:opacity-80">Venues</a>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-6" style={{ color: config.textColor }}>
        <h1 className="text-xl font-bold mb-4">Upcoming Events</h1>
        
        <div className="space-y-3">
          <div className="border rounded-lg p-3">
            <h3 className="font-semibold mb-1">Summer Music Festival</h3>
            <p className="text-sm text-gray-600 mb-2">July 15, 2025 • Central Park</p>
            <button
              style={{ backgroundColor: config.secondaryColor }}
              className="text-white px-3 py-1 rounded text-sm"
            >
              Get Tickets
            </button>
          </div>
          
          <div className="border rounded-lg p-3">
            <h3 className="font-semibold mb-1">Rock Concert Night</h3>
            <p className="text-sm text-gray-600 mb-2">July 22, 2025 • Music Hall</p>
            <button
              style={{ backgroundColor: config.accentColor }}
              className="text-white px-3 py-1 rounded text-sm"
            >
              Get Tickets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
