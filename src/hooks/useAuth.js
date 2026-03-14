import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(null);

  useEffect(() => {
    // Check session
    const checkSession = () => {
      const session = localStorage.getItem('em_session');
      const lockTime = localStorage.getItem('em_lockout');
      
      if (session) setIsAuthenticated(true);
      
      if (lockTime && parseInt(lockTime) > Date.now()) {
        setLockoutTime(parseInt(lockTime));
      } else if (lockTime) {
        localStorage.removeItem('em_lockout');
        setFailedAttempts(0);
      }
      setIsLoading(false);
    };
    
    checkSession();
  }, []);

  const login = (pin) => {
    if (lockoutTime && lockoutTime > Date.now()) return false;

    if (pin === '794848' || pin === '141000' || pin === '202425') {
      localStorage.setItem('em_session', Date.now());
      localStorage.removeItem('em_lockout');
      setFailedAttempts(0);
      setIsAuthenticated(true);
      return true;
    }

    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    
    if (newAttempts >= 3) {
      const lockUntil = Date.now() + 60000; // 1 min lock
      localStorage.setItem('em_lockout', lockUntil.toString());
      setLockoutTime(lockUntil);
    }
    
    return false;
  };

  const loginWithBiometrics = async () => {
    if (lockoutTime && lockoutTime > Date.now()) return false;
    
    if (!window.PublicKeyCredential) {
      console.error('Biometrics not supported');
      return false;
    }
    
    const credIdBase64 = localStorage.getItem('em_bio_credential');
    if (!credIdBase64) return false;

    try {
      const credId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));
      const publicKeyCredentialRequestOptions = {
        challenge: Uint8Array.from('estacion-maestra-auth-challenge', c => c.charCodeAt(0)),
        allowCredentials: [{
            id: credId,
            type: 'public-key',
        }],
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
          publicKey: publicKeyCredentialRequestOptions
      });

      if (assertion) {
        localStorage.setItem('em_session', Date.now());
        localStorage.removeItem('em_lockout');
        setFailedAttempts(0);
        setIsAuthenticated(true);
        return true;
      }
    } catch(err) {
      console.error('Biometric auth failed', err);
      return false;
    }
    return false;
  };

  const enableBiometrics = async () => {
    if (!window.PublicKeyCredential) return false;
    
    try {
      const publicKeyCredentialCreationOptions = {
        challenge: Uint8Array.from('estacion-maestra-enroll-challenge', c => c.charCodeAt(0)),
        rp: {
            name: "Estación Maestra",
        },
        user: {
            id: Uint8Array.from("admin", c => c.charCodeAt(0)),
            name: "admin",
            displayName: "Administrator",
        },
        pubKeyCredParams: [{alg: -7, type: "public-key"}],
        authenticatorSelection: {
            authenticatorAttachment: "platform", // forces local biometric like TouchID/FaceID/Windows Hello
        },
        timeout: 60000,
        attestation: "none"
      };

      const credential = await navigator.credentials.create({
          publicKey: publicKeyCredentialCreationOptions
      });
      
      localStorage.setItem('em_bio_credential', btoa(String.fromCharCode.apply(null, new Uint8Array(credential.rawId))));
      localStorage.setItem('em_bio_enabled', 'true');
      return true;
    } catch (err) {
      console.error('Biometric enrollment failed', err);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('em_session');
    setIsAuthenticated(false);
  };

  return { 
    isAuthenticated, 
    isLoading, 
    login, 
    logout, 
    loginWithBiometrics, 
    enableBiometrics,
    lockoutTime,
    failedAttempts
  };
}
