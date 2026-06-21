import { MusicIcon } from "@/components/room/icons";

type AlbumArtProps = {
  src?: string;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const sizeClasses = {
  sm: "h-10 w-10 rounded-lg",
  md: "h-12 w-12 rounded-lg",
  lg: "h-20 w-20 rounded-xl",
  xl: "h-16 w-16 rounded-xl",
};

export function AlbumArt({ src, alt, size = "sm" }: AlbumArtProps) {
  const className = `${sizeClasses[size]} shrink-0 overflow-hidden bg-zinc-800/80 object-cover transition-transform duration-200 group-hover:scale-105`;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} loading="lazy" />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center`}
      aria-hidden
    >
      <MusicIcon className="h-4 w-4 text-zinc-500" />
    </div>
  );
}
