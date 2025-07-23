
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
				// Nova paleta lunar clara
				background: '#FAF8F5',
				foreground: '#3A3A3A',
				
				// Cores lunares específicas
				lunar: {
					bg: '#FAF8F5',           // Fundo principal bege claríssimo
					surface: '#F3F1ED',      // Fundo de cards/inputs
					text: '#3A3A3A',         // Texto principal
					textSecondary: '#7C7C7C', // Texto secundário
					border: '#E1DFDA',       // Bordas sutis
					accent: '#CBA977',       // Bege dourado suave
					accentHover: '#A07C4E',  // Hover accent
					error: '#E17055',        // Erros suaves
					success: '#50C878',      // Verde esmeralda
				},
				
				border: '#E1DFDA',
				input: '#F3F1ED',
				ring: '#CBA977',
				primary: {
					DEFAULT: '#CBA977',
					foreground: '#3A3A3A'
				},
				secondary: {
					DEFAULT: '#F3F1ED',
					foreground: '#3A3A3A'
				},
				destructive: {
					DEFAULT: '#E17055',
					foreground: '#FAF8F5'
				},
				muted: {
					DEFAULT: '#F3F1ED',
					foreground: '#7C7C7C'
				},
				accent: {
					DEFAULT: '#CBA977',
					foreground: '#3A3A3A'
				},
				popover: {
					DEFAULT: '#FAF8F5',
					foreground: '#3A3A3A'
				},
				card: {
					DEFAULT: '#F3F1ED',
					foreground: '#3A3A3A'
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
				// Sombras suaves e elegantes
				'lunar': '0 2px 8px rgba(203, 169, 119, 0.1)',
				'lunar-hover': '0 4px 12px rgba(203, 169, 119, 0.15)',
				'lunar-sm': '0 1px 3px rgba(0, 0, 0, 0.05)',
				'lunar-md': '0 2px 6px rgba(0, 0, 0, 0.07)',
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
