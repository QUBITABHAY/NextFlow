import { useFlowStore } from "@/store/useFlowStore";
export function useTheme() {
  const theme = useFlowStore((state) => state.theme);
  const isLight = theme === "light";
  return { theme, isLight } as const;
}
