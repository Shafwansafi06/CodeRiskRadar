import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatRiskScore(score) {
  return (score * 100).toFixed(1);
}

export function getRiskLevel(score) {
  if (score >= 0.8) return { level: "critical", label: "Critical" };
  if (score >= 0.6) return { level: "high", label: "High" };
  if (score >= 0.4) return { level: "medium", label: "Medium" };
  return { level: "low", label: "Low" };
}

export function getRiskColor(score) {
  const { level } = getRiskLevel(score);
  const colors = {
    critical: "hsl(var(--critical))",
    high: "hsl(var(--high))",
    medium: "hsl(var(--medium))",
    low: "hsl(var(--low))",
  };
  return colors[level];
}
