import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Clock, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useFormularioPublico, useSubmitFormularioResposta } from '@/hooks/useFormularios';
import { FormularioCampo } from '@/types/formulario';
import { supabase } from '@/integrations/supabase/client';
import { useDropzone } from 'react-dropzone';

export default function FormularioPublico() {
  const { token } = useParams<{ token: string }>();
  const { data: formulario, isLoading, error } = useFormularioPublico(token);
  const submitMutation = useSubmitFormularioResposta();

  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [respondenteName, setRespondenteName] = useState('');
  const [respondenteEmail, setRespondenteEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const handleChange = (campoId: string, value: any) => {
    setRespostas((prev) => ({ ...prev, [campoId]: value }));
  };

  const handleFileUpload = async (campoId: string, files: File[]) => {
    if (files.length === 0) return;

    setUploading((prev) => ({ ...prev, [campoId]: true }));
    const uploadedUrls: string[] = respostas[campoId] || [];

    try {
      for (const file of files) {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${token}/${campoId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('formulario-uploads')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('formulario-uploads')
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }

      handleChange(campoId, uploadedUrls);
    } catch (err) {
      console.error('Erro no upload:', err);
    } finally {
      setUploading((prev) => ({ ...prev, [campoId]: false }));
    }
  };

  const removeFile = (campoId: string, index: number) => {
    const urls = [...(respostas[campoId] || [])];
    urls.splice(index, 1);
    handleChange(campoId, urls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulario) return;

    try {
      await submitMutation.mutateAsync({
        formulario,
        respostas,
        respondente_nome: respondenteName || undefined,
        respondente_email: respondenteEmail || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Erro ao enviar formulário:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !formulario) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <X className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Formulário não encontrado</h1>
          <p className="text-sm text-muted-foreground">
            Este link pode ter expirado ou o formulário não está mais disponível.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-in zoom-in-50">
            <Check className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Enviado com sucesso!</h1>
          <p className="text-muted-foreground">
            {formulario.mensagem_conclusao}
          </p>
        </div>
      </div>
    );
  }

  const camposOrdenados = [...formulario.campos].sort((a, b) => a.ordem - b.ordem);
  const camposObrigatorios = camposOrdenados.filter((c) => c.obrigatorio);
  const camposRespondidos = camposObrigatorios.filter((c) => {
    const r = respostas[c.id];
    return r !== undefined && r !== '' && (Array.isArray(r) ? r.length > 0 : true);
  });
  const progresso = camposObrigatorios.length > 0
    ? Math.round((camposRespondidos.length / camposObrigatorios.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold">
            {formulario.titulo_cliente || formulario.titulo}
          </h1>
          {formulario.descricao && (
            <p className="text-sm text-muted-foreground mt-1">{formulario.descricao}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{formulario.tempo_estimado} minutos
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Optional: Respondent info */}
          <div className="space-y-4 p-4 rounded-lg border bg-card">
            <p className="text-sm font-medium">Suas informações (opcional)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Seu nome</Label>
                <Input
                  id="nome"
                  value={respondenteName}
                  onChange={(e) => setRespondenteName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Seu email</Label>
                <Input
                  id="email"
                  type="email"
                  value={respondenteEmail}
                  onChange={(e) => setRespondenteEmail(e.target.value)}
                  placeholder="Ex: maria@email.com"
                />
              </div>
            </div>
          </div>

          {/* Dynamic fields */}
          {camposOrdenados.map((campo, idx) => (
            <CampoRenderer
              key={campo.id}
              campo={campo}
              index={idx + 1}
              total={camposOrdenados.length}
              value={respostas[campo.id]}
              onChange={(value) => handleChange(campo.id, value)}
              onFileUpload={(files) => handleFileUpload(campo.id, files)}
              onRemoveFile={(index) => removeFile(campo.id, index)}
              isUploading={uploading[campo.id]}
            />
          ))}

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar formulário'
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

interface CampoRendererProps {
  campo: FormularioCampo;
  index: number;
  total: number;
  value: any;
  onChange: (value: any) => void;
  onFileUpload: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  isUploading?: boolean;
}

function CampoRenderer({
  campo,
  index,
  total,
  value,
  onChange,
  onFileUpload,
  onRemoveFile,
  isUploading,
}: CampoRendererProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFileUpload(acceptedFiles);
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'],
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">
          {index}/{total}
        </span>
        <Label className="text-base">
          {campo.label}
          {campo.obrigatorio && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>

      {campo.descricao && (
        <p className="text-sm text-muted-foreground">{campo.descricao}</p>
      )}

      {/* Texto curto */}
      {campo.tipo === 'texto_curto' && (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.placeholder}
          required={campo.obrigatorio}
        />
      )}

      {/* Texto longo */}
      {campo.tipo === 'texto_longo' && (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.placeholder}
          required={campo.obrigatorio}
          rows={4}
        />
      )}

      {/* Data */}
      {campo.tipo === 'data' && (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={campo.obrigatorio}
        />
      )}

      {/* Seleção única */}
      {campo.tipo === 'selecao_unica' && (
        <RadioGroup value={value || ''} onValueChange={onChange}>
          {(campo.opcoes || []).map((opcao, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <RadioGroupItem value={opcao} id={`${campo.id}-${idx}`} />
              <Label htmlFor={`${campo.id}-${idx}`} className="font-normal">
                {opcao}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {/* Múltipla escolha */}
      {campo.tipo === 'multipla_escolha' && (
        <div className="space-y-2">
          {(campo.opcoes || []).map((opcao, idx) => {
            const checked = (value || []).includes(opcao);
            return (
              <div key={idx} className="flex items-center space-x-2">
                <Checkbox
                  id={`${campo.id}-${idx}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    const current = value || [];
                    if (c) {
                      onChange([...current, opcao]);
                    } else {
                      onChange(current.filter((v: string) => v !== opcao));
                    }
                  }}
                />
                <Label htmlFor={`${campo.id}-${idx}`} className="font-normal">
                  {opcao}
                </Label>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload de imagem / referência */}
      {(campo.tipo === 'upload_imagem' || campo.tipo === 'upload_referencia') && (
        <div className="space-y-3">
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? 'Solte os arquivos aqui...'
                    : 'Arraste arquivos ou clique para selecionar'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Imagens (JPG, PNG) ou PDF
                </p>
              </>
            )}
          </div>

          {/* Preview uploaded files */}
          {(value || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(value as string[]).map((url, idx) => (
                <div
                  key={idx}
                  className="relative group w-20 h-20 rounded-lg overflow-hidden border"
                >
                  <img
                    src={url}
                    alt={`Upload ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveFile(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Seleção de cores */}
      {campo.tipo === 'selecao_cores' && (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.placeholder || 'Ex: azul, verde, tons terrosos'}
        />
      )}
    </div>
  );
}
