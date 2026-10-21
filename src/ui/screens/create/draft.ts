// The draft shoot: loaded once, edited in place, and saved to the Api after every change.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Product, Shoot } from "../../../lib/contract";
import { messageOf, useApi } from "./kit";

export type DraftPatch = Partial<Pick<Shoot, "name" | "model" | "scene" | "quality" | "plan" | "draftStep">>;

export function useDraft(shootId: string | undefined) {
  const api = useApi();
  const [shoot, setShoot] = useState<Shoot | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const idRef = useRef(shootId);
  idRef.current = shootId;

  const load = useCallback(async () => {
    if (!api || !shootId) return;
    try {
      const s = await api.shoot(shootId);
      if (!s) {
        setStatus("missing");
        return;
      }
      const p = await api.product(s.productId);
      setShoot(s);
      setProduct(p);
      setStatus("ready");
    } catch (e) {
      setError(messageOf(e));
      setStatus("error");
    }
  }, [api, shootId]);

  useEffect(() => {
    setShoot(null);
    setProduct(null);
    setStatus("loading");
    if (shootId) void load();
  }, [shootId, load]);

  const patch = useCallback(
    (p: DraftPatch) => {
      if (!api || !idRef.current) return;
      const id = idRef.current;
      setShoot((s) => (s ? { ...s, ...p } : s));
      setPending((n) => n + 1);
      queue.current = queue.current
        .then(() => api.updateShoot(id, p))
        .then(
          () => setSaveError(null),
          (e) => setSaveError(messageOf(e)),
        )
        .finally(() => setPending((n) => n - 1));
    },
    [api],
  );

  const reloadProduct = useCallback(async () => {
    if (!api || !shoot) return null;
    const p = await api.product(shoot.productId);
    setProduct(p);
    return p;
  }, [api, shoot]);

  return { shoot, product, setProduct, status, error, patch, saving: pending > 0, saveError, reload: load, reloadProduct };
}
