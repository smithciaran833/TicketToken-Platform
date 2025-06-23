export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
}

export class ThemeBuilder {
  private predefinedThemes: Theme[] = [
    {
      id: 'modern-blue',
      name: 'Modern Blue',
      colors: {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#F59E0B',
        background: '#FFFFFF',
        text: '#1F2937'
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter'
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem'
      }
    },
    {
      id: 'vibrant-purple',
      name: 'Vibrant Purple',
      colors: {
        primary: '#8B5CF6',
        secondary: '#EC4899',
        accent: '#F59E0B',
        background: '#FFFFFF',
        text: '#1F2937'
      },
      fonts: {
        heading: 'Poppins',
        body: 'Inter'
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
      },
      borderRadius: {
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem'
      }
    },
    {
      id: 'elegant-dark',
      name: 'Elegant Dark',
      colors: {
        primary: '#F59E0B',
        secondary: '#10B981',
        accent: '#EF4444',
        background: '#111827',
        text: '#F9FAFB'
      },
      fonts: {
        heading: 'Montserrat',
        body: 'Inter'
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
      },
      borderRadius: {
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.5rem'
      }
    }
  ];

  getPredefinedThemes(): Theme[] {
    return this.predefinedThemes;
  }

  createCustomTheme(config: Partial<Theme>): Theme {
    return {
      id: `custom-${Date.now()}`,
      name: config.name || 'Custom Theme',
      colors: {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#F59E0B',
        background: '#FFFFFF',
        text: '#1F2937',
        ...config.colors
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        ...config.fonts
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        ...config.spacing
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        ...config.borderRadius
      }
    };
  }

  generateCSSFromTheme(theme: Theme): string {
    return `
      :root {
        --primary-color: ${theme.colors.primary};
        --secondary-color: ${theme.colors.secondary};
        --accent-color: ${theme.colors.accent};
        --background-color: ${theme.colors.background};
        --text-color: ${theme.colors.text};
        
        --heading-font: ${theme.fonts.heading}, sans-serif;
        --body-font: ${theme.fonts.body}, sans-serif;
        
        --spacing-xs: ${theme.spacing.xs};
        --spacing-sm: ${theme.spacing.sm};
        --spacing-md: ${theme.spacing.md};
        --spacing-lg: ${theme.spacing.lg};
        --spacing-xl: ${theme.spacing.xl};
        
        --radius-sm: ${theme.borderRadius.sm};
        --radius-md: ${theme.borderRadius.md};
        --radius-lg: ${theme.borderRadius.lg};
      }

      body {
        font-family: var(--body-font);
        color: var(--text-color);
        background-color: var(--background-color);
      }

      h1, h2, h3, h4, h5, h6 {
        font-family: var(--heading-font);
      }

      .btn-primary {
        background-color: var(--primary-color);
        color: white;
        border-radius: var(--radius-md);
        padding: var(--spacing-sm) var(--spacing-md);
      }

      .btn-secondary {
        background-color: var(--secondary-color);
        color: white;
        border-radius: var(--radius-md);
        padding: var(--spacing-sm) var(--spacing-md);
      }
    `;
  }

  validateTheme(theme: Theme): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate colors
    const colorRegex = /^#[0-9A-F]{6}$/i;
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (!colorRegex.test(value)) {
        errors.push(`Invalid color format for ${key}: ${value}`);
      }
    });

    // Validate fonts
    if (!theme.fonts.heading || !theme.fonts.body) {
      errors.push('Both heading and body fonts must be specified');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
