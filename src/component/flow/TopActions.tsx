import { useFlowStore } from "@/store/useFlowStore";

export function TopActions({ leftOffset }: { leftOffset: string }) {
  const theme = useFlowStore((state) => state.theme);
  const toggleTheme = useFlowStore((state) => state.toggleTheme);
  const isLight = theme === "light";

  return (
    <>
      <div
        className={`absolute top-4 z-40 h-9 rounded-xl border flex items-center gap-2.5 px-3.5 text-[13px] shadow-sm transition-all duration-300 ease-out ${leftOffset} ${isLight ? 'border-black/5 bg-white text-black/80' : 'border-white/10 bg-[#12151b]/95 text-[#eceff5]'}`}
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isLight ? 'bg-black/5' : 'bg-white/10'}`}>
           <span className={isLight ? 'text-black/40 text-[10px]' : 'text-white/50 text-[10px]'}>✦</span>
        </div>
        <span className="font-medium">Untitled</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>

      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLight ? 'border-black/5 bg-white text-black/60 hover:bg-black/5' : 'border-white/10 bg-[#12151b]/95 text-white/70 hover:bg-white/10 hover:text-white'}`}
        >
          {isLight ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>

        <button className={`h-9 rounded-xl border text-xs font-medium px-4 transition-all shadow-sm flex items-center gap-2 ${isLight ? 'border-black/5 bg-white text-black/60 hover:bg-black/5' : 'border-white/10 bg-[#12151b]/95 text-white/80 hover:bg-white/10 hover:text-white'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
          Share
        </button>

        <button className={`h-9 rounded-xl border text-xs font-medium px-4 transition-all shadow-sm hidden md:flex items-center gap-2 ${isLight ? 'border-transparent bg-black text-white hover:bg-black/90' : 'border-transparent bg-white text-black hover:bg-white/90'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
          Turn workflow into app
        </button>

        <button className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLight ? 'border-black/5 bg-white text-black/60 hover:bg-black/5' : 'border-white/10 bg-[#12151b]/95 text-white/70 hover:bg-white/10 hover:text-white'}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
        </button>
      </div>
    </>
  );
}
