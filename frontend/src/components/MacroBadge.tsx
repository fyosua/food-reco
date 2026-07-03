interface MacroBadgeProps {
  label: string;
  value: number | string | null;
  unit: string;
  color?: "green" | "blue" | "orange" | "purple" | "gray";
}

const colorMap: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  blue: "bg-blue-100 text-blue-800",
  orange: "bg-orange-100 text-orange-800",
  purple: "bg-purple-100 text-purple-800",
  gray: "bg-gray-100 text-gray-800",
};

export default function MacroBadge({ label, value, unit, color = "gray" }: MacroBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorMap[color]}`}
    >
      <span className="font-semibold">{label}</span>
      <span>{value ?? "—"}</span>
      <span className="opacity-60">{unit}</span>
    </span>
  );
}