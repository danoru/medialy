export function formatMediaType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => {
      if (part === "tv") return "TV";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function formatStatus(value: string) {
  return formatMediaType(value);
}
