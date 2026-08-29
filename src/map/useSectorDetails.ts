import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRouteDetails, fetchWaypointDetails } from "../data/c2c";
import type { Sector, SectorDetails } from "../data/types";

export type DetailEntry = SectorDetails | "loading" | "error";

/**
 * Cache des détails de secteurs, alimenté à la demande (au survol).
 * Chaque id n'est chargé qu'une fois.
 */
export function useSectorDetails() {
  const [details, setDetails] = useState<Map<number, DetailEntry>>(new Map());
  const inFlight = useRef(new Set<number>());
  const controller = useRef<AbortController>(new AbortController());

  useEffect(() => {
    // Recrée un controller à chaque (re)montage : en StrictMode le cleanup du
    // premier montage abort() sinon toutes les requêtes suivantes.
    const ctrl = new AbortController();
    controller.current = ctrl;
    return () => ctrl.abort();
  }, []);

  const request = useCallback((sector: Sector) => {
    const { id, kind } = sector;
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setDetails((m) => new Map(m).set(id, "loading"));

    const fetcher = kind === "climbing" ? fetchWaypointDetails : fetchRouteDetails;
    fetcher(id, controller.current.signal)
      .then((d) => setDetails((m) => new Map(m).set(id, d)))
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setDetails((m) => new Map(m).set(id, "error"));
      })
      .finally(() => inFlight.current.delete(id));
  }, []);

  return { details, request };
}
