import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldCheck, 
  Shield, 
  Trophy, 
  GraduationCap, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  X, 
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { UserRole } from '../types/tennis';
import { 
  ROLE_SECURITY_DEFINITIONS, 
  verifyRolePin, 
  getRolePins 
} from '../services/accessControl';

interface UnlockRoleModalProps {
  isOpen: boolean;
  targetRole: UserRole | null;
  onClose: () => void;
  onSuccess: (role: UserRole) => void;
}

export const UnlockRoleModal: React.FC<UnlockRoleModalProps> = ({
  isOpen,
  targetRole,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, targetRole]);

  if (!isOpen || !targetRole || targetRole === 'adherent') return null;

  const roleDef = ROLE_SECURITY_DEFINITIONS[targetRole];
  const currentPins = getRolePins();
  const defaultHint = currentPins[targetRole as Exclude<UserRole, 'adherent'>] || roleDef.defaultPin;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Veuillez saisir votre code PIN.');
      return;
    }

    const isValid = verifyRolePin(targetRole, pin);
    if (isValid) {
      setError(null);
      onSuccess(targetRole);
      onClose();
    } else {
      setError('Code PIN incorrect. Veuillez réessayer.');
    }
  };

  const getRoleIcon = () => {
    switch (targetRole) {
      case 'admin':
        return <ShieldCheck className="w-6 h-6 text-rose-400" />;
      case 'bureau':
        return <Shield className="w-6 h-6 text-emerald-400" />;
      case 'prof':
        return <GraduationCap className="w-6 h-6 text-purple-400" />;
      case 'capitaine':
        return <Trophy className="w-6 h-6 text-orange-400" />;
      default:
        return <Lock className="w-6 h-6 text-orange-400" />;
    }
  };

  const getRoleHeaderGradient = () => {
    switch (targetRole) {
      case 'admin':
        return 'from-rose-500/20 via-[#161a22] to-[#12151b] border-rose-500/30';
      case 'bureau':
        return 'from-emerald-500/20 via-[#161a22] to-[#12151b] border-emerald-500/30';
      case 'prof':
        return 'from-purple-500/20 via-[#161a22] to-[#12151b] border-purple-500/30';
      case 'capitaine':
        return 'from-[#FF6D00]/20 via-[#161a22] to-[#12151b] border-[#FF6D00]/30';
      default:
        return 'from-zinc-800 to-[#12151b] border-zinc-700';
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div 
        className="w-full max-w-md bg-[#131720] border-2 border-zinc-700 rounded-3xl overflow-hidden shadow-2xl relative text-left my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête avec dégradé thématique */}
        <div className={`p-5 bg-gradient-to-b ${getRoleHeaderGradient()} border-b flex items-start justify-between shrink-0`}>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
              {getRoleIcon()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <KeyRound className="w-3 h-3 text-orange-400" />
                  Code sécurisé
                </span>
              </div>
              <h3 className="font-heading font-black text-white text-lg mt-0.5">
                Accès {roleDef.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-black/30 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire de saisie du PIN */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-orange-400" />
                <span>Code PIN d'autorisation</span>
              </label>
              {targetRole === 'admin' && (
                <span className="text-[10px] text-zinc-400 font-mono">
                  (Défaut : <strong className="text-orange-400">{defaultHint}</strong>)
                </span>
              )}
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder="Saisissez le code PIN..."
                maxLength={10}
                className="w-full bg-[#0b0e14] border-2 border-zinc-700 focus:border-[#FF6D00] rounded-2xl px-4 py-3 text-center text-lg font-mono tracking-widest text-white focus:outline-none transition shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition p-1"
                title={showPin ? 'Masquer' : 'Afficher'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center space-x-1.5 text-xs text-rose-400 font-medium pt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Raccourcis pavé numérique rapide (uniquement pour l'admin) */}
          {targetRole === 'admin' && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setPin(defaultHint)}
                className="text-[11px] font-bold text-orange-400 hover:text-orange-300 hover:underline px-2 py-1 rounded cursor-pointer"
              >
                Remplir avec le code par défaut ({defaultHint})
              </button>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-orange-950/40 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Déverrouiller</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
