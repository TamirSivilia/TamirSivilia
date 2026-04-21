import { useAuth } from '@/hooks/useAuth.ts';
import { useUserStore } from '@/store/userStore.ts';
import { usePetStore } from '@/store/petStore.ts';
import { initAnalytics } from '@/lib/analytics.ts';
import { LoadingScreen } from '@/components/common/LoadingScreen.tsx';
import { ToastContainer } from '@/components/common/Toast.tsx';
import { Login } from '@/pages/Login.tsx';
import { Onboarding } from '@/pages/Onboarding.tsx';
import { Home } from '@/pages/Home.tsx';

initAnalytics();

export default function App() {
  useAuth();

  const isLoading = useUserStore(s => s.isLoading);
  const user = useUserStore(s => s.user);
  const pet = usePetStore(s => s.pet);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <LoadingScreen />
        <ToastContainer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col">
        <Login />
        <ToastContainer />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="flex-1 flex flex-col">
        <Onboarding />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Home />
      <ToastContainer />
    </div>
  );
}
