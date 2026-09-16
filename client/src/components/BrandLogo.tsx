type BrandLogoProps = {
  className?: string;
  decorative?: boolean;
};

const defaultLogoUrl = "/manus-storage/shiji-logo-512_1bdef7cb.png";
const pagesLogoUrl = `${import.meta.env.BASE_URL}logo.png`;

export const brandLogoUrl =
  import.meta.env.MODE === "pages" ? pagesLogoUrl : defaultLogoUrl;

export default function BrandLogo({ className = "", decorative = false }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src={brandLogoUrl}
      alt={decorative ? "" : "《史記》對話工作臺 Logo"}
      aria-hidden={decorative || undefined}
      width={512}
      height={512}
      decoding="async"
    />
  );
}
