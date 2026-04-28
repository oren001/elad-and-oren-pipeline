export const money = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100
  );

export const dateShort = (d: Date | number | null | undefined) => {
  if (!d) return "—";
  const x = typeof d === "number" ? new Date(d) : d;
  return x.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const dateTime = (d: Date | number | null | undefined) => {
  if (!d) return "—";
  const x = typeof d === "number" ? new Date(d) : d;
  return x.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};
