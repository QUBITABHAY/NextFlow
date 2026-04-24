import { useTheme } from "@/hooks/useTheme";

export function Dock({
  setCollapsed,
}: {
  setCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const { isLight } = useTheme();

  return (
    <div
      className={`w-[52px] h-full border-r ${isLight ? "border-black/5 bg-white" : "border-white/5 bg-[#080a0d]/95"} flex flex-col items-center gap-2.5 pt-3 transition-colors`}
    >
      <button
        className={`w-7 h-7 rounded-[7px] border grid place-items-center cursor-pointer transition-all ${isLight ? "border-black/5 bg-black/5 text-black/40 hover:bg-black/10" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"}`}
        onClick={() => setCollapsed((v) => !v)}
        aria-label="Toggle sidebar"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="w-[14px] h-[14px]"
        >
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M9 4v16" />
        </svg>
      </button>

      <div
        className={`w-[30px] h-[1px] ${isLight ? "bg-black/5" : "bg-white/5"} my-1`}
      />

      {/* Home Icon */}
      <button
        className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all ${isLight ? "bg-transparent text-black" : "text-white/95"}`}
        aria-label="Home"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      </button>

      {/* Palette Icon - Blue */}
      <button
        className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all ${isLight ? "bg-transparent text-[#0066ff]" : "text-[#0066ff]"}`}
        aria-label="Palette"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </button>

      {/* Files Icon - Pink */}
      <button
        className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all ${isLight ? "bg-transparent text-[#ff4d94]" : "text-[#ff4d94]"}`}
        aria-label="Files"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M3 9h18" />
        </svg>
      </button>

      {/* Runs Icon - Orange/Yellow */}
      <button
        className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all ${isLight ? "bg-transparent text-[#ff9900]" : "text-[#ff9900]"}`}
        aria-label="Runs"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3l-2 3H3v15h18V3h-8zm6 16H5V8h14v11z" />
        </svg>
      </button>

      <div className="flex-1" />

      {/* Settings/Profile Icon */}
      <button
        className={`w-8 h-8 mb-4 rounded-full flex items-center justify-center cursor-pointer transition-all ${isLight ? "bg-black/5 text-black/60" : "bg-white/5 text-white/60"}`}
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500"></div>
      </button>
    </div>
  );
}
