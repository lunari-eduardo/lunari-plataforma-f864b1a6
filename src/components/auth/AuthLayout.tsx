import React from 'react';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-lunar-bg via-lunar-bg-secondary to-lunar-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 text-lunar-primary">
            <Camera className="h-8 w-8" />
            <span className="text-2xl font-bold">Lunari</span>
          </Link>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground mt-2">{subtitle}</p>
            )}
          </div>

          {children}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            © 2024 Lunari. Sistema de gestão para fotógrafos.
          </p>
        </div>
      </div>
    </div>
  );
}