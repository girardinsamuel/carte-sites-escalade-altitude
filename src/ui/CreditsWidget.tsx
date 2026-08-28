import { useState } from "react";

const REPO_URL = "https://github.com/girardinsamuel/carte-sites-escalade-altitude.git";

export function CreditsWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto absolute bottom-6 right-2 z-20 flex flex-col items-end gap-2 text-white">
      {open && (
        <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs shadow-2xl backdrop-blur-md">
          <div>
            Auteur : <span className="font-medium">Samuel G</span>
          </div>
          <div className="mt-1">
            Code :{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200"
            >
              dépôt Git
            </a>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Crédits"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 text-white shadow-lg backdrop-blur-md transition hover:bg-slate-800"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z" />
        </svg>
      </button>
    </div>
  );
}
