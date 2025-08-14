
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '1rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
			},
			fontSize: {
				'2xs': ['0.625rem', { lineHeight: '0.75rem' }],
				'xs': ['0.75rem', { lineHeight: '1rem' }],
				'sm': ['0.875rem', { lineHeight: '1.25rem' }],
				'[11px]': ['0.6875rem', { lineHeight: '0.875rem' }],
			},
			spacing: {
				'0.25': '0.0625rem',
				'1.25': '0.3125rem',
				'2.25': '0.5625rem',
			},
			colors: {
				// Using HSL variables for proper theme switching
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				
				// Cores lunares específicas
				lunar: {
					bg: 'hsl(var(--lunar-bg) / <alpha-value>)',
					surface: 'hsl(var(--lunar-surface) / <alpha-value>)',
					text: 'hsl(var(--lunar-text) / <alpha-value>)',
					textSecondary: 'hsl(var(--lunar-textSecondary) / <alpha-value>)',
          border: 'hsl(var(--lunar-border) / <alpha-value>)',
          accent: 'hsl(var(--lunar-accent) / <alpha-value>)',
          accentHover: 'hsl(var(--lunar-accentHover) / <alpha-value>)',
          error: 'hsl(var(--lunar-error) / <alpha-value>)',
          success: 'hsl(var(--lunar-success) / <alpha-value>)',
          warning: 'hsl(var(--lunar-warning) / <alpha-value>)',
        },

        // Cores específicas para tarefas (prioridades)
        tasks: {
          priority: {
            high: 'hsl(var(--task-priority-high) / <alpha-value>)',
            medium: 'hsl(var(--task-priority-medium) / <alpha-value>)',
          },
        },

        // Paleta elegante para gráficos
        chart: {
          primary: '#CBA977',      // Dourado principal
          secondary: '#8B9CAE',    // Azul acinzentado
          tertiary: '#A67C6B',     // Marrom suave
          quaternary: '#9FB5A8',   // Verde acinzentado
          quinary: '#B0A8C1',      // Roxo suave
          senary: '#C4A084',       // Bege rosado
          revenue: '#70B59A',      // Verde para receitas
          expense: '#E89B8A',      // Coral para despesas
          profit: '#6B8DB5',       // Azul para lucro
          neutral: '#9CA3AF',      // Cinza neutro
        },
        
        availability: 'hsl(var(--availability) / <alpha-value>)',
        
        border: 'hsl(var(--border) / <alpha-value>)',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: '#FAF8F5',
					foreground: '#3A3A3A',
					primary: '#CBA977',
					'primary-foreground': '#3A3A3A',
					accent: '#F3F1ED',
					'accent-foreground': '#3A3A3A',
					border: '#E1DFDA',
					ring: '#CBA977'
				}
			},
			borderRadius: {
				lg: '12px',
				md: '8px',
				sm: '6px'
			},
			boxShadow: {
				// Sistema de sombras consistente
				'card-subtle': '0 1px 3px rgba(0, 0, 0, 0.05)',
				'card-elevated': '0 4px 12px rgba(0, 0, 0, 0.12)',
				'theme-subtle': '0 1px 3px hsl(var(--lunar-accent) / 0.1)',
				'theme': '0 4px 20px hsl(var(--lunar-accent) / 0.15)',
			},
			backgroundImage: {
				'brand-gradient': 'linear-gradient(135deg, hsl(var(--lunar-accent)), hsl(var(--lunar-accent) / 0.8))',
				'card-gradient': 'linear-gradient(135deg, hsl(var(--lunar-surface)), hsl(var(--lunar-bg)))',
				'subtle-gradient': 'linear-gradient(180deg, hsl(var(--lunar-surface) / 0.5), transparent)',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(4px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.98)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.2s ease-out',
				'scale-in': 'scale-in 0.15s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
