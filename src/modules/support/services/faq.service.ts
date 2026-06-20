import type { SupabaseClient } from "@supabase/supabase-js";
import type { FAQArticle, FAQCategory } from "../types";

export async function searchFAQ(sb: SupabaseClient, q: string): Promise<FAQArticle[]> {
  const { data, error } = await sb.rpc("support_faq_search", { q: q ?? "", lim: 50 });
  if (error) throw error;
  return (data ?? []) as FAQArticle[];
}

export async function listPublishedFAQ(sb: SupabaseClient): Promise<FAQArticle[]> {
  const { data, error } = await sb
    .from("support_faq_articles")
    .select("*")
    .eq("active", true)
    .eq("published", true)
    .order("category")
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as FAQArticle[];
}

export async function adminListAllFAQ(sb: SupabaseClient): Promise<FAQArticle[]> {
  const { data, error } = await sb
    .from("support_faq_articles")
    .select("*")
    .order("category")
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as FAQArticle[];
}

export async function getFAQById(sb: SupabaseClient, id: string): Promise<FAQArticle | null> {
  const { data, error } = await sb
    .from("support_faq_articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as FAQArticle | null;
}

export interface FAQUpsertPayload {
  id?: string;
  slug: string;
  category: FAQCategory;
  pergunta: string;
  resposta: string;
  keywords: string[];
  media: FAQArticle["media"];
  ordem: number;
  published: boolean;
  active: boolean;
  source_ticket_id?: string | null;
}

export async function upsertFAQ(
  sb: SupabaseClient,
  payload: FAQUpsertPayload
): Promise<FAQArticle> {
  if (payload.id) {
    const { data, error } = await sb
      .from("support_faq_articles")
      .update({
        slug: payload.slug,
        category: payload.category,
        pergunta: payload.pergunta,
        resposta: payload.resposta,
        keywords: payload.keywords,
        media: payload.media as any,
        ordem: payload.ordem,
        published: payload.published,
        active: payload.active,
      })
      .eq("id", payload.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as FAQArticle;
  } else {
    const { data, error } = await sb
      .from("support_faq_articles")
      .insert({
        slug: payload.slug,
        category: payload.category,
        pergunta: payload.pergunta,
        resposta: payload.resposta,
        keywords: payload.keywords,
        media: payload.media as any,
        ordem: payload.ordem,
        published: payload.published,
        active: payload.active,
        source_ticket_id: payload.source_ticket_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as FAQArticle;
  }
}

export async function deleteFAQ(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("support_faq_articles").delete().eq("id", id);
  if (error) throw error;
}

export async function incrementFAQView(sb: SupabaseClient, articleId: string): Promise<void> {
  await sb.rpc("support_faq_increment_view", { _article_id: articleId });
}

export async function registerFAQFeedback(
  sb: SupabaseClient,
  articleId: string,
  helpful: boolean
): Promise<void> {
  await sb.rpc("support_faq_register_feedback", {
    _article_id: articleId,
    _helpful: helpful,
  });
}

export async function getMyFAQFeedback(
  sb: SupabaseClient,
  userId: string
): Promise<Record<string, boolean>> {
  const { data, error } = await sb
    .from("support_faq_feedback")
    .select("article_id, helpful")
    .eq("user_id", userId);
  if (error) throw error;
  const map: Record<string, boolean> = {};
  (data ?? []).forEach((r: any) => {
    map[r.article_id] = r.helpful;
  });
  return map;
}
