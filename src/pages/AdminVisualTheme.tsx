import React from 'react';
import { useVisualTheme } from '@/contexts/VisualThemeContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Palette, Check } from 'lucide-react';
import { toast } from 'sonner';

function Row({ label, value, children }: { label: string; value: string | number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <Label className="text-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

export default function AdminVisualTheme() {
  const { theme, update, applyPreset, reset, presets } = useVisualTheme();

  const brandHsl = `hsl(${theme.brandH}, ${theme.brandS}%, ${theme.brandL}%)`;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">Visual Theme Studio</h1>
            <Badge variant="secondary" className="text-xs">Admin</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Controle centralizado da identidade visual. Alterações são aplicadas em tempo real
            e propagam para todos os componentes através dos design tokens.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { reset(); toast.success('Tema restaurado para o padrão'); }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Restaurar padrão
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview ao vivo */}
        <Card className="p-5 lg:col-span-1 space-y-4 sticky top-6 self-start">
          <h3 className="text-sm font-semibold text-foreground">Preview ao vivo</h3>

          <div
            className="rounded-lg p-5 border border-border"
            style={{ background: 'hsl(var(--surface-1))' }}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full" style={{ background: brandHsl }} />
                <div>
                  <div className="text-sm font-semibold text-foreground">Lunari</div>
                  <div className="text-xs text-muted-foreground">Brand preview</div>
                </div>
              </div>

              <div className="rounded-md p-3 border border-border bg-card">
                <div className="text-xs text-muted-foreground mb-2">Card elevado</div>
                <div className="text-sm text-foreground">Tipografia primária</div>
              </div>

              <div className="flex gap-2">
                <Button size="sm">Primário</Button>
                <Button size="sm" variant="secondary">Secundário</Button>
                <Button size="sm" variant="outline">Outline</Button>
              </div>

              <div
                className="rounded-md p-3 text-xs"
                style={{
                  background: `hsl(var(--glass-tint) / var(--glass-alpha-medium))`,
                  backdropFilter: `blur(var(--glass-blur-md))`,
                  WebkitBackdropFilter: `blur(var(--glass-blur-md))`,
                  border: '1px solid hsl(var(--border-subtle))',
                }}
              >
                Glassmorphism médio
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <div>Brand: <span className="font-mono">{brandHsl}</span></div>
            <div>Modo: <span className="font-mono">{theme.mode}</span></div>
            <div>Radius: <span className="font-mono">{theme.radius}px</span></div>
          </div>
        </Card>

        {/* Controles */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="presets">
            <TabsList>
              <TabsTrigger value="presets">Presets</TabsTrigger>
              <TabsTrigger value="brand">Brand</TabsTrigger>
              <TabsTrigger value="glass">Glassmorphism</TabsTrigger>
              <TabsTrigger value="mode">Modo & Forma</TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="mt-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Presets institucionais</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {presets.map((p) => {
                    const cfg = { ...theme, ...p.config };
                    const isActive = cfg.brandH === theme.brandH && cfg.brandS === theme.brandS && cfg.brandL === theme.brandL;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { applyPreset(p.id); toast.success(`Preset "${p.name}" aplicado`); }}
                        className="text-left p-3 rounded-md border border-border hover:border-primary transition-colors bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-6 h-6 rounded-full border border-border"
                              style={{ background: `hsl(${cfg.brandH}, ${cfg.brandS}%, ${cfg.brandL}%)` }}
                            />
                            <span className="text-sm font-medium text-foreground">{p.name}</span>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="brand" className="mt-4 space-y-4">
              <Card className="p-5 space-y-5">
                <Row label="Hue (matiz)" value={theme.brandH}>
                  <Slider value={[theme.brandH]} min={0} max={360} step={1}
                    onValueChange={([v]) => update({ brandH: v })} />
                </Row>
                <Row label="Saturation" value={`${theme.brandS}%`}>
                  <Slider value={[theme.brandS]} min={0} max={100} step={1}
                    onValueChange={([v]) => update({ brandS: v })} />
                </Row>
                <Row label="Lightness" value={`${theme.brandL}%`}>
                  <Slider value={[theme.brandL]} min={0} max={100} step={1}
                    onValueChange={([v]) => update({ brandL: v })} />
                </Row>
                <Row label="Hover Lightness" value={`${theme.brandHoverL}%`}>
                  <Slider value={[theme.brandHoverL]} min={0} max={100} step={1}
                    onValueChange={([v]) => update({ brandHoverL: v })} />
                </Row>
                <Row label="Glow Lightness" value={`${theme.brandGlowL}%`}>
                  <Slider value={[theme.brandGlowL]} min={0} max={100} step={1}
                    onValueChange={([v]) => update({ brandGlowL: v })} />
                </Row>
              </Card>
            </TabsContent>

            <TabsContent value="glass" className="mt-4 space-y-4">
              <Card className="p-5 space-y-5">
                <Row label="Alpha leve" value={theme.glassAlphaLight.toFixed(2)}>
                  <Slider value={[theme.glassAlphaLight * 100]} min={0} max={100} step={1}
                    onValueChange={([v]) => update({ glassAlphaLight: v / 100 })} />
                </Row>
                <Row label="Alpha médio" value={theme.glassAlphaMedium.toFixed(2)}>
                  <Slider value={[theme.glassAlphaMedium * 100]} min={0} max={100} step={1}
                    onValueChange={([v]) => update({ glassAlphaMedium: v / 100 })} />
                </Row>
                <Row label="Alpha pesado" value={theme.glassAlphaHeavy.toFixed(2)}>
                  <Slider value={[theme.glassAlphaHeavy * 100]} min={0} max={100} step={1}
                    onValueChange={([v]) => update({ glassAlphaHeavy: v / 100 })} />
                </Row>
                <Row label="Blur SM" value={`${theme.glassBlurSm}px`}>
                  <Slider value={[theme.glassBlurSm]} min={0} max={40} step={1}
                    onValueChange={([v]) => update({ glassBlurSm: v })} />
                </Row>
                <Row label="Blur MD" value={`${theme.glassBlurMd}px`}>
                  <Slider value={[theme.glassBlurMd]} min={0} max={40} step={1}
                    onValueChange={([v]) => update({ glassBlurMd: v })} />
                </Row>
                <Row label="Blur LG" value={`${theme.glassBlurLg}px`}>
                  <Slider value={[theme.glassBlurLg]} min={0} max={60} step={1}
                    onValueChange={([v]) => update({ glassBlurLg: v })} />
                </Row>
              </Card>
            </TabsContent>

            <TabsContent value="mode" className="mt-4 space-y-4">
              <Card className="p-5 space-y-5">
                <div className="space-y-2">
                  <Label className="text-foreground">Modo de cor</Label>
                  <div className="flex gap-2">
                    {(['light', 'dark', 'system'] as const).map((m) => (
                      <Button key={m} size="sm"
                        variant={theme.mode === m ? 'default' : 'outline'}
                        onClick={() => update({ mode: m })}
                      >
                        {m === 'light' ? 'Claro' : m === 'dark' ? 'Escuro' : 'Sistema'}
                      </Button>
                    ))}
                  </div>
                </div>

                <Row label="Border radius" value={`${theme.radius}px`}>
                  <Slider value={[theme.radius]} min={0} max={24} step={1}
                    onValueChange={([v]) => update({ radius: v })} />
                </Row>
              </Card>

              <p className="text-xs text-muted-foreground">
                As preferências são salvas localmente no navegador. A migração para Supabase
                (sincronização entre dispositivos e config global do admin) pode ser ativada
                posteriormente sem mudanças no contrato.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
