import { nwsFetch } from "./client";
import type { ForecastDiscussion, PointMeta } from "./types";

interface ProductListResponse {
  "@graph": Array<{
    id: string;
    issuanceTime: string;
    productName: string;
  }>;
}

interface ProductResponse {
  id: string;
  issuanceTime: string;
  productName: string;
  productText: string;
}

/**
 * Fetch the latest text product of a given type (AFD, HWO, …) issued by the
 * point's Weather Forecast Office.
 */
export async function getTextProduct(
  meta: PointMeta,
  type: string,
  signal?: AbortSignal,
): Promise<ForecastDiscussion | null> {
  const list = await nwsFetch<ProductListResponse>(
    `/products/types/${type}/locations/${meta.gridId}`,
    { signal },
  );
  const latest = list["@graph"]?.[0];
  if (!latest) return null;

  const product = await nwsFetch<ProductResponse>(`/products/${latest.id}`, { signal });
  return {
    wfo: meta.gridId,
    issuanceTime: product.issuanceTime,
    text: product.productText,
    productName: product.productName,
  };
}

/**
 * The Area Forecast Discussion — the raw, plain-language narrative written by
 * the forecaster at the local WFO.
 */
export async function getForecastDiscussion(
  meta: PointMeta,
  signal?: AbortSignal,
): Promise<ForecastDiscussion | null> {
  return getTextProduct(meta, "AFD", signal);
}

/**
 * The Hazardous Weather Outlook — issued ahead of expected hazards. Not a CAP
 * alert, so it never appears in /alerts/active; weather.gov surfaces it under
 * "Hazardous Weather Conditions" and so do we.
 */
export async function getHazardousOutlook(
  meta: PointMeta,
  signal?: AbortSignal,
): Promise<ForecastDiscussion | null> {
  return getTextProduct(meta, "HWO", signal);
}
