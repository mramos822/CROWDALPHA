import { useCallback, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkProps {
  linkToken: string;
  onSuccess: (publicToken: string) => void;
  onError: (error: string) => void;
  onReady?: () => void;
}

export interface PlaidLinkHandle {
  open: () => void;
  ready: boolean;
}

export const PlaidLink = forwardRef<PlaidLinkHandle, PlaidLinkProps>(({ linkToken, onSuccess, onError, onReady }, ref) => {
  const onSuccess_plaid = useCallback((publicToken: string) => {
    onSuccess(publicToken);
  }, [onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onSuccess_plaid,
    onExit: (err) => {
      if (err) onError(err.error_message);
    }
  });

  // Store onReady in a ref to avoid recreating the effect
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Notify parent when ready status changes
  useEffect(() => {
    console.log('🔄 [PLAID] Ready status changed:', ready, 'Link token:', linkToken ? 'exists' : 'missing', 'onReady:', !!onReadyRef.current);
    if (ready) {
      if (onReadyRef.current) {
        console.log('✅ [PLAID] Plaid Link is ready! Calling onReady callback...');
        try {
          onReadyRef.current();
          console.log('✅ [PLAID] onReady callback executed successfully');
        } catch (error) {
          console.error('❌ [PLAID] Error in onReady callback:', error);
        }
      } else {
        console.warn('⚠️ [PLAID] Plaid is ready but no onReady callback provided');
      }
    }
  }, [ready, linkToken]);

  useImperativeHandle(ref, () => ({
    open: () => {
      console.log('🔓 [PLAID] open() called, ready:', ready);
      open();
    },
    ready: ready
  }), [open, ready]);

  return null; // Don't render anything, parent will control the button
});