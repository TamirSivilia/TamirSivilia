import { useTranslation } from 'react-i18next';

interface Props {
  message?: string;
}

export function LoadingScreen({ message }: Props) {
  const { t } = useTranslation();

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
      <p className="text-gray-400 text-sm mt-2">{message ?? t('app.loading')}</p>
    </div>
  );
}
