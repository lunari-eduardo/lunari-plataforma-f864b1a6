import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Image as ImageIcon } from 'lucide-react';

export default function GalleryPlaceholder() {
  return (
    <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ImageIcon className="size-6 text-muted-foreground" />
            Lunari Gallery
          </h1>
          <p className="text-muted-foreground">
            Sua ferramenta de seleção e entrega de imagens.
          </p>
        </div>
      </div>

      <Card className="border-dashed shadow-none bg-muted/30">
        <CardHeader>
          <CardTitle>Módulo em breve</CardTitle>
          <CardDescription>
            A integração da Gallery com o ecossistema Lunari está sendo preparada. 
            Em breve você poderá gerenciar suas galerias e seleções diretamente por aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-md border border-dashed flex flex-col items-center justify-center text-muted-foreground space-y-2">
            <ImageIcon className="size-10 opacity-20" />
            <p className="text-sm font-medium">Estrutura reservada</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
