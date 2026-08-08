-- RPC para incrementar total_views de um link público atomicamente
CREATE OR REPLACE FUNCTION increment_share_link_views(link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE material_share_links
  SET total_views = total_views + 1
  WHERE id = link_id;
END;
$$;
