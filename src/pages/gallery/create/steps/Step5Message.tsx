import { MessageSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { defaultWelcomeMessage } from '@/data/mockData';

export interface Step5MessageProps {
  welcomeMessageEnabled: boolean;
  setWelcomeMessageEnabled: (enabled: boolean) => void;
  welcomeMessage: string;
  setWelcomeMessage: (msg: string) => void;
  settings: any;
}

export function Step5Message({
  welcomeMessageEnabled,
  setWelcomeMessageEnabled,
  welcomeMessage,
  setWelcomeMessage,
  settings,
}: Step5MessageProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-muted-foreground text-lg">
          Personalize a mensagem que o cliente verá ao acessar a galeria
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <Label>Mensagem de Saudação</Label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Ativar mensagem</Label>
            <Switch
              checked={welcomeMessageEnabled}
              onCheckedChange={(checked) => {
                setWelcomeMessageEnabled(checked);
                if (!checked) setWelcomeMessage('');
                else if (settings?.defaultWelcomeMessage)
                  setWelcomeMessage(settings.defaultWelcomeMessage);
                else setWelcomeMessage(defaultWelcomeMessage);
              }}
            />
          </div>
        </div>
        {welcomeMessageEnabled && (
          <>
            <Textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Personalize a mensagem de boas-vindas..."
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{cliente}'}, {'{sessao}'}, {'{estudio}'} para personalização automática.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
