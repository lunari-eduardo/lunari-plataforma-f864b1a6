import { useState, useEffect } from 'react';
import { SUPABASE_URL } from '../types';

interface UseClientGalleryAuthProps {
  identifier?: string;
  galleryResponse: any;
  refetchGallery: () => Promise<any>;
}

export function useClientGalleryAuth({
  identifier,
  galleryResponse,
  refetchGallery,
}: UseClientGalleryAuthProps) {
  // Password state
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [sessionPassword, setSessionPassword] = useState<string | null>(() => {
    return identifier ? sessionStorage.getItem(`gallery_password_${identifier}`) : null;
  });

  // Visitor state (public galleries)
  const [requiresVisitor, setRequiresVisitor] = useState(false);
  const [visitorError, setVisitorError] = useState<string | undefined>();
  const [isRegisteringVisitor, setIsRegisteringVisitor] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(() => {
    return identifier ? localStorage.getItem(`gallery_visitor_${identifier}`) : null;
  });
  const [visitorName, setVisitorName] = useState<string | null>(() => {
    return identifier ? localStorage.getItem(`gallery_visitor_name_${identifier}`) : null;
  });

  // Handle password and visitor requirement from response
  useEffect(() => {
    if (galleryResponse?.requiresPassword) {
      setRequiresPassword(true);
    }
    if (galleryResponse?.requiresVisitor) {
      setRequiresVisitor(true);
    }
    // Recover visitor info from response
    if (galleryResponse?.visitorId && !visitorId && identifier) {
      setVisitorId(galleryResponse.visitorId);
      setVisitorName(galleryResponse.visitorName || null);
      localStorage.setItem(`gallery_visitor_${identifier}`, galleryResponse.visitorId);
      if (galleryResponse.visitorName) {
        localStorage.setItem(`gallery_visitor_name_${identifier}`, galleryResponse.visitorName);
      }
    }
    // Also check gallery.visitorId (nested in gallery object)
    if (galleryResponse?.gallery?.visitorId && !visitorId && identifier) {
      setVisitorId(galleryResponse.gallery.visitorId);
      setVisitorName(galleryResponse.gallery.visitorName || null);
      localStorage.setItem(`gallery_visitor_${identifier}`, galleryResponse.gallery.visitorId);
      if (galleryResponse.gallery.visitorName) {
        localStorage.setItem(`gallery_visitor_name_${identifier}`, galleryResponse.gallery.visitorName);
      }
    }
  }, [galleryResponse, identifier, visitorId]);

  // Handle password submit
  const handlePasswordSubmit = async (password: string) => {
    if (!identifier) return;
    setIsCheckingPassword(true);
    setPasswordError(undefined);
    
    try {
      sessionStorage.setItem(`gallery_password_${identifier}`, password);
      setSessionPassword(password);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gallery-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: identifier, 
          password: password 
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.code === 'WRONG_PASSWORD') {
          setPasswordError('Senha incorreta');
          sessionStorage.removeItem(`gallery_password_${identifier}`);
          return;
        }
        throw new Error(result.error || 'Erro ao acessar galeria');
      }
      
      // Success - refetch gallery data
      await refetchGallery();
      setRequiresPassword(false);
    } catch (error) {
      setPasswordError('Erro ao verificar senha');
      sessionStorage.removeItem(`gallery_password_${identifier}`);
    } finally {
      setIsCheckingPassword(false);
    }
  };

  // Handle visitor identification for public galleries
  const handleVisitorSubmit = async (data: { nome: string; contato: string; contatoTipo: 'email' | 'whatsapp' }) => {
    if (!identifier) return;
    setIsRegisteringVisitor(true);
    setVisitorError(undefined);
    
    try {
      // Generate simple device hash
      const deviceHash = btoa(`${data.contato}:${navigator.userAgent}`).slice(0, 64);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gallery-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: identifier, 
          password: sessionPassword,
          visitorData: {
            nome: data.nome,
            contato: data.contato,
            contatoTipo: data.contatoTipo,
            deviceHash,
          },
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setVisitorError(result.error || 'Erro ao registrar');
        return;
      }
      
      const newVisitorId = result.visitorId || result.gallery?.visitorId;
      const newVisitorName = result.visitorName || result.gallery?.visitorName;
      
      if (newVisitorId) {
        setVisitorId(newVisitorId);
        setVisitorName(newVisitorName || data.nome);
        localStorage.setItem(`gallery_visitor_${identifier}`, newVisitorId);
        localStorage.setItem(`gallery_visitor_name_${identifier}`, newVisitorName || data.nome);
        setRequiresVisitor(false);
        await refetchGallery();
      } else {
        setVisitorError('Erro ao criar sessão do visitante');
      }
    } catch (error) {
      setVisitorError('Erro ao conectar');
    } finally {
      setIsRegisteringVisitor(false);
    }
  };

  return {
    requiresPassword,
    setRequiresPassword,
    passwordError,
    isCheckingPassword,
    sessionPassword,
    handlePasswordSubmit,
    requiresVisitor,
    setRequiresVisitor,
    visitorError,
    isRegisteringVisitor,
    visitorId,
    visitorName,
    handleVisitorSubmit,
  };
}
