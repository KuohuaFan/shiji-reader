const normalizedBase = (() => {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
})();

export const isStaticPagesBuild = import.meta.env.MODE === "pages";
export const officialSiteUrl = "https://shijiread.manus.space";
export const apiBaseUrl = isStaticPagesBuild ? officialSiteUrl : "";

export function appHref(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  const relative = path.replace(/^\/+/, "");
  return `${normalizedBase}${relative}`;
}

export function chapterHref(volume: number) {
  return `${normalizedBase}?chapter=${volume}`;
}

export function reviewHref() {
  return isStaticPagesBuild ? `${officialSiteUrl}/review` : appHref("review");
}

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export const routerBase = normalizedBase === "/" ? "/" : normalizedBase.slice(0, -1);
