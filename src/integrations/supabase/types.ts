export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          orcamento_id: string | null
          origem: string | null
          package_id: string | null
          paid_amount: number | null
          session_id: string
          status: string | null
          time: string
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          orcamento_id?: string | null
          origem?: string | null
          package_id?: string | null
          paid_amount?: number | null
          session_id: string
          status?: string | null
          time: string
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          orcamento_id?: string | null
          origem?: string | null
          package_id?: string | null
          paid_amount?: number | null
          session_id?: string
          status?: string | null
          time?: string
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cor: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          telefone: string
          updated_at: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          telefone: string
          updated_at?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          telefone?: string
          updated_at?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      clientes_documentos: {
        Row: {
          cliente_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          storage_path: string
          tamanho: number
          tipo: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          storage_path: string
          tamanho: number
          tipo: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          storage_path?: string
          tamanho?: number
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_familia: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_nascimento: string | null
          id: string
          nome: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          nome?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          nome?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_familia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_sessoes: {
        Row: {
          appointment_id: string | null
          categoria: string
          cliente_id: string
          created_at: string | null
          data_sessao: string
          descricao: string | null
          hora_sessao: string
          id: string
          orcamento_id: string | null
          pacote: string | null
          produtos_incluidos: Json | null
          session_id: string
          status: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
          valor_pago: number | null
          valor_total: number | null
        }
        Insert: {
          appointment_id?: string | null
          categoria: string
          cliente_id: string
          created_at?: string | null
          data_sessao: string
          descricao?: string | null
          hora_sessao: string
          id?: string
          orcamento_id?: string | null
          pacote?: string | null
          produtos_incluidos?: Json | null
          session_id: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          valor_pago?: number | null
          valor_total?: number | null
        }
        Update: {
          appointment_id?: string | null
          categoria?: string
          cliente_id?: string
          created_at?: string | null
          data_sessao?: string
          descricao?: string | null
          hora_sessao?: string
          id?: string
          orcamento_id?: string | null
          pacote?: string | null
          produtos_incluidos?: Json | null
          session_id?: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          valor_pago?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_sessoes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_sessoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_transacoes: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_transacao: string
          descricao: string | null
          id: string
          session_id: string | null
          tipo: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_transacao: string
          descricao?: string | null
          id?: string
          session_id?: string | null
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_transacao?: string
          descricao?: string | null
          id?: string
          session_id?: string | null
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "clientes_transacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_transacoes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clientes_sessoes"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "fk_transacoes_session_id"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clientes_sessoes"
            referencedColumns: ["session_id"]
          },
        ]
      }
      etapas_trabalho: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cor: string
          created_at?: string
          id?: string
          nome: string
          ordem: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      modelo_de_preco: {
        Row: {
          created_at: string
          id: string
          modelo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modelo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modelo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pacotes: {
        Row: {
          categoria_id: string
          created_at: string
          id: string
          nome: string
          produtos_incluidos: Json
          updated_at: string
          user_id: string
          valor_base: number
          valor_foto_extra: number
        }
        Insert: {
          categoria_id: string
          created_at?: string
          id?: string
          nome: string
          produtos_incluidos?: Json
          updated_at?: string
          user_id: string
          valor_base: number
          valor_foto_extra?: number
        }
        Update: {
          categoria_id?: string
          created_at?: string
          id?: string
          nome?: string
          produtos_incluidos?: Json
          updated_at?: string
          user_id?: string
          valor_base?: number
          valor_foto_extra?: number
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          created_at: string
          id: string
          nome: string
          preco_custo: number
          preco_venda: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          preco_custo?: number
          preco_venda?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          preco_custo?: number
          preco_venda?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tabelas_precos: {
        Row: {
          categoria_id: string | null
          created_at: string
          faixas: Json
          id: string
          nome: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          faixas?: Json
          id?: string
          nome: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          faixas?: Json
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_precos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
