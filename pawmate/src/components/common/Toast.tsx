import { useUIStore } from '@/store/uiStore.ts';

export function ToastContainer() {
  const toasts = useUIStore(s => s.toasts);
  const removeToast = useUIStore(s => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 440, margin: '0 auto', right: 'auto', left: 'auto', width: 'calc(100% - 2rem)' }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl
            border backdrop-blur-sm cursor-pointer
            ${toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-100' : ''}
            ${toast.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' : ''}
            ${toast.type === 'info' ? 'bg-gray-800/90 border-gray-600 text-gray-100' : ''}
            ${toast.type === 'reward' ? 'bg-yellow-900/90 border-yellow-600 text-yellow-100' : ''}
          `}
        >
          {toast.emoji && <span className="text-xl">{toast.emoji}</span>}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
