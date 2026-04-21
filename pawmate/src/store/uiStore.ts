import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'reward';
  emoji?: string;
}

interface UIStore {
  shopOpen: boolean;
  settingsOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];
  currentScene: 'home' | 'walk';
  showGuestNudge: boolean;

  openShop: () => void;
  closeShop: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openModal: (name: string) => void;
  closeModal: () => void;
  addToast: (message: string, type?: Toast['type'], emoji?: string) => void;
  removeToast: (id: string) => void;
  setScene: (scene: UIStore['currentScene']) => void;
  setShowGuestNudge: (show: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  shopOpen: false,
  settingsOpen: false,
  activeModal: null,
  toasts: [],
  currentScene: 'home',
  showGuestNudge: false,

  openShop: () => set({ shopOpen: true }),
  closeShop: () => set({ shopOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),

  addToast: (message, type = 'info', emoji) => {
    const id = crypto.randomUUID();
    set(state => ({ toasts: [...state.toasts, { id, message, type, emoji }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },

  removeToast: (id) =>
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  setScene: (currentScene) => set({ currentScene }),
  setShowGuestNudge: (showGuestNudge) => set({ showGuestNudge }),
}));
