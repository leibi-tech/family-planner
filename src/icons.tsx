// Einheitliche, runde Symbole (statt Emojis). Strichzeichnung, Farbe = Textfarbe.
const PATHS: Record<string, string> = {
  start: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  einkauf: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12h11.8l2-8H6"/>',
  todo: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 12l3 3 5-6"/>',
  notizen: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>',
  kalender: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  plan: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  menues: '<path d="M7 3v18M4 3v5a3 3 0 006 0V3M17 21V3c-2.2 1.6-3.5 4.6-3.5 8H17"/>',
  dokumente: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  familie: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15.5 14.5c3 0 5.5 2 5.5 5.5"/>',
  leiste: '<rect x="3" y="14" width="18" height="6" rx="3"/><path d="M7 9h10M9 5h6"/>',
  aussehen: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/>',
  wolke: '<path d="M7 18h10a4 4 0 00.5-8 6 6 0 00-11.3 1.5A3.3 3.3 0 007 18z"/>',
  sync: '<path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/>',
  warn: '<path d="M12 3.5l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.3"/>',
};

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  if (name === 'mehr')
    return (
      <svg className="ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none">
        <circle cx="5" cy="12" r="1.9" />
        <circle cx="12" cy="12" r="1.9" />
        <circle cx="19" cy="12" r="1.9" />
      </svg>
    );
  return (
    <svg
      className="ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? '' }}
    />
  );
}
