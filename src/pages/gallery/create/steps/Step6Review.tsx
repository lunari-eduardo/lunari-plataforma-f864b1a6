import { User, Tag, Settings, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Client,
  SaleMode,
  PricingModel,
  DiscountPackage,
  ImageResizeOption,
  WatermarkType,
} from '@/types/gallery';

export interface Step6ReviewProps {
  selectedClient: Client | null;
  sessionName: string;
  packageName: string;
  includedPhotos: number;
  saleMode: SaleMode;
  getSaleModeLabel: () => string;
  getPaymentMethodLabel: () => string;
  getPricingModelLabel: () => string;
  getChargeTypeLabel: () => string;
  fixedPrice: number;
  pricingModel: PricingModel;
  discountPackages: DiscountPackage[];
  uploadedCount: number;
  customDays: number;
  imageResizeOption: ImageResizeOption;
  watermarkType: WatermarkType;
  allowComments: boolean;
  allowDownload: boolean;
}

export function Step6Review({
  selectedClient,
  sessionName,
  packageName,
  includedPhotos,
  saleMode,
  getSaleModeLabel,
  getPaymentMethodLabel,
  getPricingModelLabel,
  getChargeTypeLabel,
  fixedPrice,
  pricingModel,
  discountPackages,
  uploadedCount,
  customDays,
  imageResizeOption,
  watermarkType,
  allowComments,
  allowDownload,
}: Step6ReviewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-muted-foreground text-lg">
          Confira as informações antes de criar a galeria
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="lunari-card p-5 space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Informações do Cliente
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{selectedClient?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{selectedClient?.email || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sessão</span>
              <span className="font-medium">{sessionName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pacote</span>
              <span className="font-medium">{packageName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fotos incluídas</span>
              <span className="font-medium">{includedPhotos}</span>
            </div>
          </div>
        </div>

        <div className="lunari-card p-5 space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Configuração de Venda
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modo de venda</span>
              <span className="font-medium">{getSaleModeLabel()}</span>
            </div>
            {saleMode === 'sale_with_payment' && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Método de pagamento</span>
                <Badge variant="outline" className="font-medium border-primary/40 text-primary">
                  {getPaymentMethodLabel()}
                </Badge>
              </div>
            )}
            {saleMode !== 'no_sale' && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modelo de preço</span>
                  <span className="font-medium">{getPricingModelLabel()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo de cobrança</span>
                  <span className="font-medium">{getChargeTypeLabel()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor por foto</span>
                  <span className="font-medium">R$ {fixedPrice.toFixed(2)}</span>
                </div>
                {fixedPrice > 100 && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Confira: R$ {fixedPrice.toFixed(2)} por foto extra.</p>
                      <p className="text-yellow-700/80 dark:text-yellow-300/80">
                        Valores acima de R$ 100 são incomuns. Se estiver errado, volte ao Passo 2.
                      </p>
                    </div>
                  </div>
                )}
                {pricingModel === 'packages' && discountPackages.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pacotes de desconto</span>
                    <span className="font-medium">{discountPackages.length} configurados</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="lunari-card p-5 space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Configurações
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fotos</span>
              <span className="font-medium">{uploadedCount} arquivos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prazo</span>
              <span className="font-medium">{customDays} dias</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tamanho</span>
              <span className="font-medium">{imageResizeOption}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Proteção</span>
              <span className="font-medium capitalize">
                {watermarkType === 'none'
                  ? 'Nenhuma'
                  : watermarkType === 'standard'
                  ? 'Padrão do Sistema'
                  : 'Minha Marca'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Comentários</span>
              <span className="font-medium">{allowComments ? 'Sim' : 'Não'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Download</span>
              <span className="font-medium">{allowDownload ? 'Ativado' : 'Desativado'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-primary/10 text-sm">
        <p className="text-primary font-medium mb-1">✨ Pronto para criar!</p>
        <p className="text-muted-foreground">
          Após criar a galeria, você poderá enviar o link de seleção para o cliente.
        </p>
      </div>
    </div>
  );
}
