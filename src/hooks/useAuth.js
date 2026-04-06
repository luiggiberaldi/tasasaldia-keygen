import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { LOCKOUT_DURATION_MS, MAX_LOGIN_ATTEMPTS } from '../utils/constants';

// PINs válidos leídos desde variables de entorno (nunca hardcodeados)
const VALID_PINS = [
  import.meta.env.VITE_ADMIN_PIN_1,
  import.meta.env.VITE_ADMIN_PIN_2,
  import.meta.env.VITE_ADMIN_PIN_3,
].filter(Boolean);

// Lockout también en memoria para evitar bypass borrando localStorage
let memoryLockoutUntil = null;

function generateSessionToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function generateChallenge() {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(null);

  useEffect(() => {
    const checkSession = () => {
      const session = localStorage.getItem('em_session');
      const lockTime = localStorage.getItem('em_lockout');

      if (session) setIsAuthenticated(true);

      const lockUntil = lockTime ? parseInt(lockTime) : null;
      const effectiveLock = Math.max(lockUntil || 0, memoryLockoutUntil || 0);

      if (effectiveLock > Date.now()) {
        setLockoutTime(effectiveLock);
      } else {
        localStorage.removeItem('em_lockout');
        memoryLockoutUntil = null;
        setFailedAttempts(0);
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  const isLockedOut = () => {
    const lsLock = parseInt(localStorage.getItem('em_lockout') || '0');
    const effectiveLock = Math.max(lsLock, memoryLockoutUntil || 0);
    return effectiveLock > Date.now();
  };

  const login = (pin) => {
    if (isLockedOut()) return false;

    if (VALID_PINS.includes(pin)) {
      const token = generateSessionToken();
      localStorage.setItem('em_session', token);
      localStorage.removeItem('em_lockout');
      memoryLockoutUntil = null;
      setFailedAttempts(0);
      setIsAuthenticated(true);
      return true;
    }

    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem('em_lockout', lockUntil.toString());
      memoryLockoutUntil = lockUntil;
      setLockoutTime(lockUntil);
    }

    return false;
  };

  const loginWithBiometrics = async () => {
    if (isLockedOut()) return false;

    if (!window.PublicKeyCredential) return false;

    const credIdBase64 = localStorage.getItem('em_bio_credential');
    if (!credIdBase64) return false;

    let credId;
    try {
      credId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));
    } catch {
      // Credencial corrupta — limpiar y requerir re-enrolamiento
      localStorage.removeItem('em_bio_credential');
      localStorage.removeItem('em_bio_enabled');
      return false;
    }

    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: generateChallenge(),
          allowCredentials: [{ id: credId, type: 'public-key' }],
          timeout: 60000,
        },
      });

      if (assertion) {
        const token = generateSessionToken();
        localStorage.setItem('em_session', token);
        localStorage.removeItem('em_lockout');
        memoryLockoutUntil = null;
        setFailedAttempts(0);
        setIsAuthenticated(true);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const enableBiometrics = async () => {
    if (!window.PublicKeyCredential) return false;

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: generateChallenge(),
          rp: { name: 'Estación Maestra' },
          user: {
            id: Uint8Array.from('admin', c => c.charCodeAt(0)),
            name: 'admin',
            displayName: 'Administrator',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: { authenticatorAttachment: 'platform' },
          timeout: 60000,
          attestation: 'none',
        },
      });

      localStorage.setItem(
        'em_bio_credential',
        btoa(String.fromCharCode.apply(null, new Uint8Array(credential.rawId)))
      );
      localStorage.setItem('em_bio_enabled', 'true');
      return true;
    } catch {
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
    failedAttempts,
  };
}
