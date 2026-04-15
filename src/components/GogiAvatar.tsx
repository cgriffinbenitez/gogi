// GogiAvatar.tsx
// Single source of truth for the Gogi "G" avatar used across all interaction
// components and session views.
//
// size="md" (default) — w-10 h-10, used in all protocol interaction steps
// size="sm"           — w-8 h-8,  used in conversational chat bubbles

export default function GogiAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const text = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`${dim} rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center flex-shrink-0 self-start mt-0.5`}
    >
      <span className={`text-white ${text} font-extrabold leading-none select-none`}>G</span>
    </div>
  );
}
