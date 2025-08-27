import { useUserPreferences } from './useUserProfile';
import { RegimeTributario } from '@/types/userProfile';

export function useRegimeTributario() {
  const { preferences, savePreferences, getPreferencesOrDefault } = useUserPreferences();

  const regime = preferences?.regimeTributario || getPreferencesOrDefault().regimeTributario;

  const isMEI = () => regime === 'mei';
  const isSimples = () => regime === 'simples';
  const isDREVisible = () => isSimples();

  const updateRegime = (novoRegime: RegimeTributario) => {
    return savePreferences({ regimeTributario: novoRegime });
  };

  return {
    regime,
    isMEI,
    isSimples,
    isDREVisible,
    updateRegime
  };
}