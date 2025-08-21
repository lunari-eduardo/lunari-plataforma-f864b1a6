import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ThemeColorKey = 'verde' | 'terracota' | 'rosa' | 'cinza' | 'azul' | 'lilas' | 'bege' | 'marrom'

const COLORS: { key: ThemeColorKey; label: string; hex: `#${string}` }[] = [
  { key: 'marrom', label: 'Marrom (padrão)', hex: '#5F3624' },
  { key: 'verde', label: 'Verde', hex: '#98b281' },
  { key: 'terracota', label: 'Terracota', hex: '#893806' },
  { key: 'rosa', label: 'Rosa', hex: '#d8a4ce' },
  { key: 'cinza', label: 'Cinza', hex: '#494949' },
  { key: 'azul', label: 'Azul', hex: '#1c4274' },
  { key: 'lilas', label: 'Lilás', hex: '#beb7fb' },
  { key: 'bege', label: 'Bege', hex: '#dbbd96' },
]

interface ThemeColorPickerProps {
  valueKey?: ThemeColorKey
  valueHex?: string
  onChange: (next: { temaCor: ThemeColorKey; temaCorHex: string }) => void
}

export default function ThemeColorPicker({ valueKey, valueHex, onChange }: ThemeColorPickerProps) {
  const activeKey = valueKey || 'marrom'
  const activeHex = valueHex || COLORS.find(c => c.key === activeKey)?.hex || '#5F3624'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {COLORS.map(({ key, label, hex }) => {
          const selected = key === activeKey || hex.toLowerCase() === activeHex.toLowerCase()
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ temaCor: key, temaCorHex: hex })}
              className={cn(
                'flex items-center gap-3 p-3 rounded-md border transition-all duration-150',
                selected ? 'border-lunar-accent ring-1 ring-lunar-accent bg-lunar-bg' : 'border-lunar-border hover:bg-lunar-bg'
              )}
              aria-pressed={selected}
            >
              <span
                className="inline-flex h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-background"
                style={{ backgroundColor: hex }}
                aria-hidden
              />
              <div className="flex-1 text-left">
                <div className="text-xs font-medium text-lunar-text">{label}</div>
                <div className="text-[11px] text-lunar-textSecondary">{hex}</div>
              </div>
              {selected && <Check className="text-lunar-accent" size={16} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
