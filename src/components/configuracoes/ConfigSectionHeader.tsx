import React from 'react';

interface ConfigSectionHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export default function ConfigSectionHeader({ 
  title, 
  subtitle, 
  action 
}: ConfigSectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
