import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserPlus, User, Cake, LayoutGrid, List } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { AniversariantesModal } from '@/components/crm/AniversariantesModal';
import { ClientFiltersBar } from '@/components/crm/ClientFiltersBar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DuplicateWarningDialog } from '@/components/clientes/DuplicateWarningDialog';

import { ViewMode } from './clientes/types';
import { useClientesPageData } from './clientes/hooks/useClientesPageData';
import { useClienteFormState } from './clientes/hooks/useClienteFormState';
import { ClientesTable } from './clientes/components/ClientesTable';
import { ClientesGrid } from './clientes/components/ClientesGrid';
import { ClientesPagination } from './clientes/components/ClientesPagination';
import { ClienteFormDialog } from './clientes/components/ClienteFormDialog';

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAniversariantesModal, setShowAniversariantesModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const {
    clientesSupabase,
    isLoadingSupabase,
    adicionarClienteSupabase,
    atualizarClienteSupabase,
    removerClienteSupabase,
    verificarClienteTemDados,
    clientesLegacy,
    clientMetrics,
    filters,
    setFilters,
    limparFiltros,
    clientesFiltrados,
    sortConfig,
    handleSort,
    currentPage,
    setCurrentPage,
    totalPages,
    clientesPaginados,
    getPageNumbers,
    ITEMS_PER_PAGE,
    clientesOrdenadosCount,
  } = useClientesPageData();

  const {
    showClientForm,
    setShowClientForm,
    editingClient,
    formData,
    setFormData,
    handleSelectOpenChange,
    handleModalClose,
    showSuggestions,
    showDuplicateDialog,
    forceCreate,
    setForceCreate,
    setShowSuggestions,
    duplicateCheck,
    handleAddClient,
    handleEditClient,
    handleDeleteClient,
    handleSaveClient,
    handleEditSuggestion,
    handleDismissSuggestions,
    handleEditDuplicate,
    handleCreateAnyway,
    handleCancelDuplicate,
    handleWhatsApp,
    dialogState,
    handleConfirm,
    handleCancel,
    handleClose,
  } = useClienteFormState({
    clientesSupabase,
    clientMetrics,
    adicionarClienteSupabase,
    atualizarClienteSupabase,
    removerClienteSupabase,
    verificarClienteTemDados,
  });

  // Check for openBirthdays parameter and auto-open modal
  useEffect(() => {
    if (searchParams.get('openBirthdays') === 'true') {
      setShowAniversariantesModal(true);
      searchParams.delete('openBirthdays');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <PageContainer className="py-4">
      <PageHeader
        title="Clientes"
        description={isLoadingSupabase ? 'Carregando…' : `${clientesSupabase.length} cliente(s) cadastrado(s)`}
        action={
          <>
            <div className="flex items-center overflow-hidden rounded-lg border border-border/20">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="h-8 rounded-none px-2.5"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 rounded-none px-2.5"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAniversariantesModal(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <Cake className="h-3.5 w-3.5 text-accent-gold" />
              Aniversariantes
            </Button>
            <Button size="sm" onClick={handleAddClient} className="h-8 gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              Novo Cliente
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        {/* Filtros */}
        <ClientFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          totalClients={clientMetrics.length}
          filteredClients={clientesFiltrados.length}
        />

        {/* Visualização em Lista */}
        {viewMode === 'list' && clientesPaginados.length > 0 && (
          <ClientesTable
            clientes={clientesPaginados}
            sortConfig={sortConfig}
            onSort={handleSort}
            onWhatsApp={handleWhatsApp}
            onEdit={handleEditClient}
            onDelete={handleDeleteClient}
          />
        )}

        {/* Visualização em Cards */}
        {viewMode === 'cards' && clientesPaginados.length > 0 && (
          <ClientesGrid
            clientes={clientesPaginados}
            onWhatsApp={handleWhatsApp}
            onEdit={handleEditClient}
            onDelete={handleDeleteClient}
          />
        )}

        {/* Paginação */}
        <ClientesPagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={ITEMS_PER_PAGE}
          totalItems={clientesOrdenadosCount}
          pageNumbers={getPageNumbers()}
          onPageChange={setCurrentPage}
        />

        {/* Estado Vazio */}
        {clientesFiltrados.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-12 text-center">
            <User className="mb-3 h-10 w-10 text-accent-gold" />
            <h3 className="text-[15px] font-semibold text-foreground">Nenhum cliente encontrado</h3>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">
              {filters.filtro ||
              filters.dataInicio ||
              filters.dataFim ||
              (filters.categoria && filters.categoria !== 'todas')
                ? 'Não encontramos clientes com os critérios de busca informados.'
                : 'Adicione seus primeiros clientes para começar.'}
            </p>
            {filters.filtro ||
            filters.dataInicio ||
            filters.dataFim ||
            (filters.categoria && filters.categoria !== 'todas') ? (
              <Button onClick={limparFiltros} variant="outline" size="sm" className="h-8 text-xs">
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={handleAddClient} size="sm" className="h-8 gap-1.5 text-xs">
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar Cliente
              </Button>
            )}
          </div>
        )}

        {/* Modal de Formulário */}
        <ClienteFormDialog
          open={showClientForm}
          onOpenChange={handleModalClose}
          editingClient={editingClient}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSaveClient}
          duplicateCheck={duplicateCheck}
          showSuggestions={showSuggestions}
          onEditSuggestion={handleEditSuggestion}
          onDismissSuggestions={handleDismissSuggestions}
          forceCreate={forceCreate}
          setForceCreate={setForceCreate}
          setShowSuggestions={setShowSuggestions}
          onSelectOpenChange={handleSelectOpenChange}
        />

        {/* Dialog de aviso de duplicata */}
        <DuplicateWarningDialog
          open={showDuplicateDialog}
          cliente={duplicateCheck.clienteDuplicado}
          onEditExisting={handleEditDuplicate}
          onCreateAnyway={handleCreateAnyway}
          onCancel={handleCancelDuplicate}
        />

        {/* Modal de Aniversariantes */}
        <AniversariantesModal
          open={showAniversariantesModal}
          onOpenChange={setShowAniversariantesModal}
          clientes={clientesLegacy}
        />

        {/* Confirm Dialog */}
        <ConfirmDialog
          state={dialogState}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onClose={handleClose}
        />
      </div>
    </PageContainer>
  );
}