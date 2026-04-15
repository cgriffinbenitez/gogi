// GogiAvatar.tsx
// Single source of truth for the Gogi avatar used across all interaction
// components and session views.
//
// size="md" (default) — w-10 h-10 (40×40), used in protocol interaction steps
// size="sm"           — w-8 h-8  (32×32), used in conversational chat bubbles
//
// NOTE: Place the logo image at /public/gogi-avatar.png

export default function GogiAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  return (
    <div
      className={`${dim} rounded-full flex-shrink-0 self-start mt-0.5 overflow-hidden`}
      style={{ boxShadow: '0 0 12px rgba(29, 158, 117, 0.4)' }}
    >
      <img
        src="/gogi-avatar.png"
        alt="Gogi"
        className="w-full h-full object-cover rounded-full"
        onError={(e) => {
          // Fallback to "G" monogram if image not yet placed
          const target = e.currentTarget;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent && !parent.querySelector('.gogi-fallback')) {
            parent.classList.add('bg-[#0d1f18]', 'border', 'border-[#1D9E75]/40', 'items-center', 'justify-center');
            const span = document.createElement('span');
            span.className = 'gogi-fallback text-[#1D9E75] font-extrabold leading-none select-none text-sm';
            span.textContent = 'G';
            parent.appendChild(span);
          }
        }}
      />
    </div>
  );
}
