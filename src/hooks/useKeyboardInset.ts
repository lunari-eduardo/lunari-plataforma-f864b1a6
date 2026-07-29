/**
 * useKeyboardInset — mede o quanto o teclado virtual (iOS/Android) cobre a viewport.
 *
 * Retorna a distância em pixels entre o rodapé da janela e o rodapé da
 * visualViewport. Ideal para aplicar como `padding-bottom` no rodapé de
 * bottom-sheets/painéis para que botões não fiquem escondidos pelo teclado.
 *
 * - Zero em desktop, iPad em split-view sem teclado, ou navegadores sem
 *   `visualViewport`.
 * - Só apresentação/UX — nenhuma regra de negócio.
 */
import { useEffect, useState } from 'react';
import { supports } from '@/lib/platform';

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!supports.visualViewport) return;
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // altura escondida pelo teclado = layout - visual
        const hidden = Math.max(
          0,
          window.innerHeight - vv.height - vv.offsetTop,
        );
        // Ignora ruído sub-pixel/barras de URL (< 80px normalmente é chrome do browser).
        setInset(hidden > 80 ? Math.round(hidden) : 0);
      });
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}

export default useKeyboardInset;
