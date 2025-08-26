
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
				display: ['Playfair Display', 'serif'],
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

        // Landing page colors
        landing: {
          bg: 'hsl(var(--landing-bg) / <alpha-value>)',
          text: 'hsl(var(--landing-text) / <alpha-value>)',
          accent: 'hsl(var(--landing-accent) / <alpha-value>)',
          brand: 'hsl(var(--landing-brand) / <alpha-value>)',
        },

        // Brand colors for components
        brand: 'hsl(var(--brand) / <alpha-value>)',
        'brand-foreground': 'hsl(var(--brand-foreground) / <alpha-value>)',

        // Cores específicas para tarefas (prioridades)
        tasks: {
          priority: {
            high: 'hsl(var(--task-priority-high) / <alpha-value>)',
            medium: 'hsl(var(--task-priority-medium) / <alpha-value>)',
          },
        },

        // Paleta monocromática elegante baseada no tema lunar
        chart: {
          primary: 'hsl(var(--chart-primary))',
          secondary: 'hsl(var(--chart-secondary))',
          tertiary: 'hsl(var(--chart-tertiary))',
          quaternary: 'hsl(var(--chart-quaternary))',
          quinary: 'hsl(var(--chart-quinary))',
          senary: 'hsl(var(--chart-senary))',
          revenue: 'hsl(var(--chart-revenue))',
          expense: 'hsl(var(--chart-expense))',
          profit: 'hsl(var(--chart-profit))',
          neutral: 'hsl(var(--chart-neutral))',
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
				'card-subtle': '0 2px 6px rgba(0, 0, 0, 0.08)',
				'card-elevated': '0 8px 24px rgba(0, 0, 0, 0.15)',
				'theme-subtle': '0 2px 6px hsl(var(--lunar-accent) / 0.12)',
				'theme': '0 8px 24px hsl(var(--lunar-accent) / 0.20)',
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
				},
				appear: {
					'0%': { 
						opacity: '0', 
						transform: 'translateY(10px)' 
					},
					'100%': { 
						opacity: '1', 
						transform: 'translateY(0)' 
					}
				},
				'appear-zoom': {
					'0%': { 
						opacity: '0', 
						transform: 'scale(0.95)' 
					},
					'100%': { 
						opacity: '1', 
						transform: 'scale(1)' 
					}
				},
				'fade-up': {
					'0%': {
						opacity: '0',
						transform: 'translateY(20px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'gradient-shift': {
					'0%, 100%': {
						backgroundPosition: '0% 50%'
					},
					'50%': {
						backgroundPosition: '100% 50%'
					}
				},
				'float': {
					'0%, 100%': {
						transform: 'translateY(0px)'
					},
					'50%': {
						transform: 'translateY(-4px)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.2s ease-out',
				'scale-in': 'scale-in 0.15s ease-out',
				appear: 'appear 0.5s ease-out forwards',
				'appear-zoom': 'appear-zoom 0.5s ease-out forwards',
				'fade-up': 'fade-up 0.6s ease-out forwards',
				'gradient-shift': 'gradient-shift 3s ease-in-out infinite',
				'float': 'float 3s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
