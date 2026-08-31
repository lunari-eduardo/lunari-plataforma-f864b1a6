import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from("clientes_transacoes").insert({
    user_id: "db0ca3d8-8848-4194-aa74-40d265b73849",
    cliente_id: "a8262c61-7d20-4a2f-b021-222a4b3fc37e",
    session_id: "agenda-1788154426097-lvwjcm14src",
    tipo: "pagamento",
    valor: 33,
    valor_liquido: 33,
    descricao: "Entrada do agendamento",
    data_transacao: "2026-08-31"
  });
  console.log("Error:", error);
  console.log("Data:", data);
}
test();
