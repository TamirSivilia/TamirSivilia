import { t } from '@/lib/i18n.ts';

interface Props {
  message?: string;
}

export function LoadingScreen({ message }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 gap-4">
      <div className="text-5xl animate-bounce">🐾</div>
      <div className="text-xl font-bold text-white">Pawmate</div>
      <div className="flex gap-1 mt-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 bg-red-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      {message && (
        <p className="text-gray-400 text-sm mt-2">{message}</p>
      )}
      {!message && (
        <p className="text-gray-400 text-sm mt-2">{t.app.loading}</p>
      )}
    </div>
  );
}
