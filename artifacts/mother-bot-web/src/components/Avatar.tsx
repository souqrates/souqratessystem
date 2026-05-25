type Props = {
  src?: string | null;
  name: string;
  size?: number;
  ring?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "?";
  return parts[0].slice(0, 1);
}

export default function Avatar({ src, name, size = 56, ring = false }: Props) {
  const style = { width: size, height: size, fontSize: size * 0.45 };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={`rounded-full object-cover bg-panel ${
          ring ? "ring-2 ring-gold ring-offset-2 ring-offset-bg" : ""
        }`}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      style={style}
      className={`rounded-full bg-gradient-to-br from-gold to-amber-700 grid place-items-center font-black text-black ${
        ring ? "ring-2 ring-gold ring-offset-2 ring-offset-bg" : ""
      }`}
    >
      {initials(name)}
    </div>
  );
}
