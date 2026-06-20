import { useEffect, useState, useCallback, useMemo } from "react";
import { useSupportHost } from "../SupportHostProvider";
import * as svc from "../services/faq.service";
import type { FAQArticle } from "../types";

export function useFAQSearch(query: string) {
  const host = useSupportHost();
  const [results, setResults] = useState<FAQArticle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const rows = await svc.searchFAQ(host.supabase, query);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [host, query]);

  return { results, loading };
}

export function useFAQList(adminMode = false) {
  const host = useSupportHost();
  const [articles, setArticles] = useState<FAQArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const rows = adminMode
        ? await svc.adminListAllFAQ(host.supabase)
        : await svc.listPublishedFAQ(host.supabase);
      setArticles(rows);
    } finally {
      setLoading(false);
    }
  }, [host, adminMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const grouped = useMemo(() => {
    const map: Record<string, FAQArticle[]> = {};
    for (const a of articles) {
      (map[a.category] ??= []).push(a);
    }
    return map;
  }, [articles]);

  return { articles, grouped, loading, refresh };
}

export function useFAQFeedback() {
  const host = useSupportHost();
  const [my, setMy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!host.currentUser) return;
    svc.getMyFAQFeedback(host.supabase, host.currentUser.id).then(setMy).catch(() => {});
  }, [host]);

  const register = useCallback(
    async (articleId: string, helpful: boolean) => {
      setMy((m) => ({ ...m, [articleId]: helpful }));
      await svc.registerFAQFeedback(host.supabase, articleId, helpful);
    },
    [host]
  );

  return { my, register };
}
