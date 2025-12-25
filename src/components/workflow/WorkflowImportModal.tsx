/**
 * Modal de importação de planilha para o Workflow
 */
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  AlertTriangle
} from 'lucide-react';
import { useWorkflowImport } from '@/hooks/useWorkflowImport';
import { ImportResult } from '@/types/spreadsheetImport';

interface WorkflowImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  onImportComplete?: () => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function WorkflowImportModal({
  open,
  onOpenChange,
  year,
  month,
  onImportComplete
}: WorkflowImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  const {
    parseFile,
    importSessions,
    downloadTemplate,
    clearParsedData,
    parsedData,
    isImporting,
    progress
  } = useWorkflowImport({ year, month });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
      await parseFile(file);
    }
  }, [parseFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    disabled: isImporting
  });

  const handleImport = async () => {
    const result = await importSessions();
    setImportResult(result);
    
    if (result.success && onImportComplete) {
      onImportComplete();
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setSelectedFile(null);
      setImportResult(null);
      clearParsedData();
      onOpenChange(false);
    }
  };

  const getProgressPercent = () => {
    if (!progress) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const sessionsForMonth = parsedData?.sessions.filter(s => {
    const d = new Date(s.data_sessao);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  }) || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha - {MONTH_NAMES[month - 1]} {year}
          </DialogTitle>
          <DialogDescription>
            Importe sessões de uma planilha Excel (.xlsx) para o mês selecionado.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Área de Upload */}
            {!importResult && (
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                  ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-primary font-medium">Solte o arquivo aqui...</p>
                ) : (
                  <>
                    <p className="font-medium">
                      Arraste uma planilha ou clique para selecionar
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Formatos aceitos: .xlsx, .xls
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Botão Download Template */}
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template de Exemplo
              </Button>
            </div>

            {/* Arquivo Selecionado */}
            {selectedFile && !importResult && (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertTitle>Arquivo selecionado</AlertTitle>
                <AlertDescription>
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </AlertDescription>
              </Alert>
            )}

            {/* Erros de Parse */}
            {parsedData && parsedData.errors.length > 0 && !importResult && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erros encontrados ({parsedData.errors.length})</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-32 mt-2">
                    <ul className="text-sm space-y-1">
                      {parsedData.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>
                          Linha {err.row}: {err.message}
                        </li>
                      ))}
                      {parsedData.errors.length > 10 && (
                        <li className="text-muted-foreground">
                          ... e mais {parsedData.errors.length - 10} erros
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {parsedData && parsedData.warnings.length > 0 && !importResult && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Avisos ({parsedData.warnings.length})</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-24 mt-2">
                    <ul className="text-sm space-y-1">
                      {parsedData.warnings.slice(0, 5).map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            {/* Preview dos Dados */}
            {parsedData && parsedData.sessions.length > 0 && !importResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    Preview dos dados
                  </h4>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {parsedData.sessions.length} sessões na planilha
                    </Badge>
                    <Badge variant="secondary">
                      {sessionsForMonth.length} para {MONTH_NAMES[month - 1]}
                    </Badge>
                  </div>
                </div>
                
                {sessionsForMonth.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Nenhuma sessão para este mês</AlertTitle>
                    <AlertDescription>
                      A planilha não contém sessões para {MONTH_NAMES[month - 1]} {year}.
                      Verifique se as datas estão corretas ou selecione outro mês.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Hora</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Pacote</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionsForMonth.slice(0, 5).map((session, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              {new Date(session.data_sessao + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>{session.hora_sessao}</TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {session.cliente_nome}
                            </TableCell>
                            <TableCell>{session.categoria}</TableCell>
                            <TableCell>{session.pacote || '-'}</TableCell>
                            <TableCell className="text-right">
                              {session.valor_total
                                ? `R$ ${session.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {sessionsForMonth.length > 5 && (
                      <div className="p-2 text-center text-sm text-muted-foreground border-t">
                        ... e mais {sessionsForMonth.length - 5} sessões
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            {isImporting && progress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progress.message}
                  </span>
                  <span>{getProgressPercent()}%</span>
                </div>
                <Progress value={getProgressPercent()} />
              </div>
            )}

            {/* Resultado da Importação */}
            {importResult && (
              <div className="space-y-4">
                <Alert variant={importResult.success ? 'default' : 'destructive'}>
                  {importResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {importResult.success ? 'Importação concluída!' : 'Importação com erros'}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      <p>✓ {importResult.imported.clients} clientes criados</p>
                      <p>✓ {importResult.imported.sessions} sessões importadas</p>
                      <p>✓ {importResult.imported.payments} pagamentos registrados</p>
                      {importResult.skipped > 0 && (
                        <p className="text-muted-foreground">
                          ⊘ {importResult.skipped} sessões puladas (outros meses)
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {importResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erros durante importação</AlertTitle>
                    <AlertDescription>
                      <ScrollArea className="max-h-32 mt-2">
                        <ul className="text-sm space-y-1">
                          {importResult.errors.map((err, i) => (
                            <li key={i}>
                              {err.row > 0 ? `Linha ${err.row}: ` : ''}{err.message}
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {importResult ? 'Fechar' : 'Cancelar'}
          </Button>
          
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={
                !parsedData ||
                sessionsForMonth.length === 0 ||
                parsedData.errors.length > 0 ||
                isImporting
              }
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {sessionsForMonth.length} Sessões
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
