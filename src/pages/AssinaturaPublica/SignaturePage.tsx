import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { 
  Loader2, 
  FileSignature, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  RotateCcw, 
  ShieldCheck, 
  Lock, 
  Ban, 
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { maskCpfCnpj, validateCpfCnpj, unmaskDigits } from '@/lib/validateCpfCnpj';

const API_BASE = import.meta.env.VITE_EDGE_API_URL || 'https://lunari-edge-api.eduardo22diehl.workers.dev';

export default function SignaturePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contractData, setContractData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    async function fetchContract() {
      try {
        const res = await fetch(`${API_BASE}/contracts/native/get/${token}`);
        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error || 'Erro ao carregar o contrato');
        }

        setContractData(json.contrato);
        if (json.contrato?.cliente?.nome) {
          setName(json.contrato.cliente.nome);
        }
        if (json.contrato?.cliente?.documento) {
          setCpf(maskCpfCnpj(json.contrato.cliente.documento));
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    if (token) fetchContract();
  }, [token]);

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const masked = maskCpfCnpj(raw);
    setCpf(masked);
    
    const digits = unmaskDigits(masked);
    if (digits.length === 11) {
      if (!validateCpfCnpj(masked)) {
        setCpfError('CPF com dígitos verificadores inválidos.');
      } else {
        setCpfError(null);
      }
    } else {
      setCpfError(null);
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2500);
      toast({ title: 'Hash copiado para a área de transferência!' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || name.trim().length < 3) {
      toast({ title: 'Nome incompleto', description: 'Por favor, digite seu nome completo.', variant: 'destructive' });
      return;
    }

    const cleanCpf = unmaskDigits(cpf);
    if (cleanCpf.length !== 11 || !validateCpfCnpj(cpf)) {
      setCpfError('Informe um CPF válido.');
      toast({ title: 'CPF inválido', description: 'O CPF informado é inválido.', variant: 'destructive' });
      return;
    }

    if (sigCanvas.current?.isEmpty()) {
      toast({ 
        title: 'Assinatura obrigatória', 
        description: 'Por favor, desenhe sua assinatura no campo indicado.', 
        variant: 'destructive' 
      });
      return;
    }

    if (!consent) {
      setConsentError(true);
      toast({ 
        title: 'Consentimento obrigatório', 
        description: 'Você precisa marcar a caixa de concordância com a assinatura eletrônica.', 
        variant: 'destructive' 
      });
      return;
    }

    setSubmitting(true);
    try {
      const signatureImage = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
      
      let geolocation = null;
      if ('geolocation' in navigator) {
        try {
          const pos: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          geolocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
        } catch {
          // Permissão negada ou timeout — continua normalmente
        }
      }

      const res = await fetch(`${API_BASE}/contracts/native/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signature_image: signatureImage,
          name: name.trim(),
          cpf: cleanCpf,
          geolocation
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao processar assinatura');

      setSuccess(true);
      setDocumentHash(json.document_hash);
      toast({ 
        title: 'Contrato assinado com sucesso!', 
        description: 'O documento foi autenticado e arquivado digitalmente.' 
      });
    } catch (e: any) {
      toast({ title: 'Erro ao assinar', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadUrl = `${API_BASE}/contracts/native/download/${token}`;

  // Estado de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
        <p className="text-sm font-medium animate-pulse">Carregando documento seguro...</p>
      </div>
    );
  }

  // Estado de Erro de Acesso
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-xl border-slate-200">
          <CardHeader className="text-center">
            <div className="mx-auto bg-red-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-slate-900">Documento indisponível</CardTitle>
            <CardDescription className="text-sm mt-2 text-slate-600">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Estado de Contrato Cancelado
  if (contractData?.status === 'cancelado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-xl border-slate-200">
          <CardHeader className="text-center">
            <div className="mx-auto bg-amber-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-3">
              <Ban className="w-6 h-6 text-amber-600" />
            </div>
            <CardTitle className="text-xl text-slate-900">Contrato Cancelado</CardTitle>
            <CardDescription className="text-sm mt-2 text-slate-600">
              Este contrato foi cancelado pelo emissor ({contractData?.fotografo?.nome || 'o fotógrafo'}) e não aceita mais assinaturas.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Estado de Contrato Já Assinado (ou recém-assinado nesta sessão)
  if (success || contractData?.status === 'assinado') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-lg shadow-xl border-slate-200">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto bg-emerald-100 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Documento Assinado!</CardTitle>
            <CardDescription className="text-sm mt-2 text-slate-600">
              Sua assinatura foi registrada e vinculada permanentemente ao documento com plena eficácia e validade jurídica.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 pt-2">
            <div className="bg-slate-100 rounded-lg p-4 text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between items-center text-slate-600">
                <span>Documento:</span>
                <span className="font-semibold text-slate-800">{contractData?.titulo}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Emissor:</span>
                <span className="font-medium text-slate-800">{contractData?.fotografo?.nome}</span>
              </div>
              {contractData?.assinado_em && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>Data da Assinatura:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(contractData.assinado_em).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              {documentHash && (
                <div className="pt-2 border-t border-slate-200 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Hash de Integridade (SHA-256):</span>
                    <button 
                      type="button" 
                      onClick={() => handleCopyHash(documentHash)}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {copiedHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHash ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <code className="bg-white p-2 rounded border text-[11px] font-mono break-all text-slate-700">
                    {documentHash}
                  </code>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button asChild className="w-full h-11 text-base bg-slate-900 hover:bg-slate-800 shadow-md">
                <a href={downloadUrl} target="_blank" rel="noreferrer" download>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Contrato Assinado (PDF)
                </a>
              </Button>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-slate-100 pt-4 pb-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Conforme MP 2.200-2/2001 e Lei Federal 14.063/2020</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Formulário Ativo de Assinatura
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex flex-col items-center">
      {/* Barra de Identificação e Segurança */}
      <div className="w-full max-w-3xl mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md text-primary">
              <FileSignature className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              Assinatura de Contrato
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enviado por <strong className="text-slate-800">{contractData?.fotografo?.nome || 'Fotógrafo'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {contractData?.has_pdf && (
            <Button variant="outline" size="sm" asChild className="text-xs">
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                <Download className="w-3.5 h-3.5 mr-1" />
                Visualizar PDF
              </a>
            </Button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-full font-medium">
            <Lock className="w-3 h-3" />
            <span>Ambiente Seguro</span>
          </div>
        </div>
      </div>

      {/* Caixa de Leitura do Conteúdo do Contrato */}
      <div className="w-full max-w-3xl bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden mb-6">
        <div className="bg-slate-100/70 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm md:text-base">{contractData?.titulo}</h2>
          <span className="text-xs text-slate-500 font-mono">Via Digital</span>
        </div>
        <div className="p-6 md:p-8 max-h-[500px] overflow-y-auto prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed border-b border-slate-100">
          <div dangerouslySetInnerHTML={{ __html: contractData?.conteudo || '' }} />
        </div>
        <div className="bg-slate-50 px-6 py-2.5 text-xs text-slate-500 text-center">
          Role até o final do documento para revisar todas as cláusulas antes de assinar.
        </div>
      </div>

      {/* Formulário de Assinatura */}
      <Card className="w-full max-w-3xl shadow-lg border-slate-200">
        <form onSubmit={handleSubmit}>
          <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl">
            <CardTitle className="text-lg md:text-xl text-slate-900">Confirmar e Assinar</CardTitle>
            <CardDescription className="text-sm">
              Preencha seus dados cadastrais e desenhe sua assinatura para emitir a via autenticada.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Seu nome completo" 
                  required
                  disabled={submitting}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">CPF</label>
                <Input 
                  value={cpf} 
                  onChange={handleCpfChange} 
                  placeholder="000.000.000-00" 
                  maxLength={14}
                  required
                  disabled={submitting}
                  className={`h-10 ${cpfError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {cpfError && (
                  <p className="text-xs text-red-600 font-medium">{cpfError}</p>
                )}
              </div>
            </div>

            {/* Canvas de Assinatura Mobile-First com Touch-Action Protegido */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-700">
                  Assinatura na Tela
                </label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearSignature}
                  disabled={submitting}
                  className="h-7 text-xs text-slate-500 hover:text-slate-900 px-2"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Limpar
                </Button>
              </div>

              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 overflow-hidden relative shadow-inner touch-none"
                style={{ height: '220px', touchAction: 'none' }}
              >
                <SignatureCanvas 
                  ref={sigCanvas} 
                  canvasProps={{ 
                    className: 'w-full h-full cursor-crosshair touch-none',
                    style: { touchAction: 'none' }
                  }} 
                  backgroundColor="rgba(255,255,255,0)"
                  penColor="#0f172a"
                />
                <div className="absolute bottom-2 left-3 pointer-events-none text-[11px] text-slate-400 select-none">
                  Desenhe com o dedo ou mouse acima
                </div>
              </div>
            </div>

            {/* Checkbox de Consentimento Legal */}
            <div 
              className={`flex items-start space-x-3 p-4 rounded-xl border transition-colors ${
                consentError && !consent
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-blue-50/70 border-blue-100'
              }`}
            >
              <Checkbox 
                id="consent" 
                checked={consent} 
                onCheckedChange={(c) => {
                  setConsent(c === true);
                  if (c === true) setConsentError(false);
                }} 
                disabled={submitting}
                className="mt-1"
              />
              <div className="grid gap-1 leading-none">
                <label
                  htmlFor="consent"
                  className="text-sm font-semibold leading-tight text-slate-900 cursor-pointer select-none"
                >
                  Concordo com os termos e assino eletronicamente este contrato
                </label>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Declaro que li e aceito todas as condições deste documento. Reconheço a validade jurídica desta assinatura eletrônica para todos os fins de direito, em conformidade com a <strong>Medida Provisória nº 2.200-2/2001</strong> e a <strong>Lei Federal nº 14.063/2020</strong>.
                </p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-slate-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>IP, carimbo de data/hora e hash de integridade serão registrados.</span>
            </div>

            <Button 
              type="submit" 
              disabled={submitting} 
              className="w-full sm:w-auto min-w-[220px] h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando Assinatura...
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4 mr-2" />
                  Finalizar e Assinar
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
