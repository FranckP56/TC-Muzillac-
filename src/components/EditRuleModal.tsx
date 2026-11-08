import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  RotateCcw, 
  Scale, 
  Calendar, 
  Users, 
  Check, 
  AlertTriangle,
  Info
} from 'lucide-react';
import { ChampionshipRule, OFFICIAL_GAME_FORMATS } from '../types/rules';

interface EditRuleModalProps {
  isOpen: boolean;
  rule: ChampionshipRule | null;
  onClose: () => void;
  onSave: (updatedRule: ChampionshipRule) => void;
  onReset: (ruleId: string) => void;
}

export const EditRuleModal: React.FC<EditRuleModalProps> = ({
  isOpen,
  rule,
  onClose,
  onSave,
  onReset,
}) => {
  const [formData, setFormData] = useState<ChampionshipRule | null>(null);

  useEffect(() => {
    if (rule) {
      setFormData({ ...rule });
    }
  }, [rule]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('Voulez-vous rétablir les paramètres officiels FFT par défaut pour ce championnat ?')) {
      onReset(formData.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-[#131720] border-2 border-orange-500/40 rounded-3xl overflow-hidden shadow-2xl relative text-left flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="p-5 bg-gradient-to-r from-orange-500/20 via-[#181d27] to-[#12151b] border-b border-zinc-700/80 flex items-start justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {formData.level}
                </span>
                <span className="text-[10px] text-zinc-400">
                  Sexe : <strong className="text-white">{formData.sexe}</strong>
                </span>
              </div>
              <h3 className="font-heading font-black text-white text-base sm:text-lg mt-0.5">
                Modifier le règlement : {formData.title}
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

        {/* Corps formulaire avec scroll */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 text-orange-200 flex items-center gap-2.5">
            <Info className="w-4 h-4 text-orange-400 shrink-0" />
            <span>
              Les modifications apportées ici sont immédiatement appliquées aux contrôles d'éligibilité, aux compositions d'équipes et à l'ordonnancement des matchs.
            </span>
          </div>

          {/* Intitulé & Division */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Titre du championnat</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-[#0b0e14] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Division officielle</label>
              <input
                type="text"
                value={formData.division}
                onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                className="w-full bg-[#0b0e14] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                required
              />
            </div>
          </div>

          {/* Configuration des Simples */}
          <div className="p-4 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-3">
            <h4 className="font-black text-orange-400 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <span>1. Épreuve de Simples</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Nombre de simples</label>
                <select
                  value={formData.numSingles}
                  onChange={(e) => setFormData({ ...formData, numSingles: parseInt(e.target.value, 10) })}
                  className="w-full bg-[#131720] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value={1}>1 Simple</option>
                  <option value={2}>2 Simples (Jeunes)</option>
                  <option value={3}>3 Simples (Dames D2/D3, Seniors+)</option>
                  <option value={4}>4 Simples (Régional, PR, D1)</option>
                  <option value={5}>5 Simples (Hommes D2/D3)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-zinc-300 block mb-1">Format de jeu des simples</label>
                <input
                  type="text"
                  value={formData.singlesGameFormat}
                  onChange={(e) => setFormData({ ...formData, singlesGameFormat: e.target.value })}
                  placeholder="Ex: Format 1 : 2 sets à 6 jeux, 3e set classique"
                  className="w-full bg-[#131720] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Configuration des Doubles */}
          <div className="p-4 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-3">
            <h4 className="font-black text-purple-400 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <span>2. Épreuve de Doubles</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Nombre de doubles</label>
                <select
                  value={formData.numDoubles}
                  onChange={(e) => setFormData({ ...formData, numDoubles: parseInt(e.target.value, 10) })}
                  className="w-full bg-[#131720] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value={0}>0 Double</option>
                  <option value={1}>1 Double</option>
                  <option value={2}>2 Doubles (Régional, PR, D1 Messieurs)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-zinc-300 block mb-1">Format de jeu des doubles</label>
                <input
                  type="text"
                  value={formData.doublesGameFormat}
                  onChange={(e) => setFormData({ ...formData, doublesGameFormat: e.target.value })}
                  placeholder="Ex: Format 4 : 2 sets à 6 jeux avec No-Ad, 3e set Super Tie-Break 10 pts"
                  className="w-full bg-[#131720] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Règle Poids des Doubles */}
            <div className="pt-2 border-t border-zinc-800/80">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.doubleWeightStrict}
                  onChange={(e) => setFormData({ ...formData, doubleWeightStrict: e.target.checked })}
                  className="rounded accent-orange-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white block">
                    Règle stricte du poids des doubles FFT (Poids D1 ≥ Poids D2)
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    Exigée en Régionale, Pré-Régionale et D1 Messieurs pour éviter toute inversion stratégique.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Logistique, Déroulement & Jour */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Jour officiel de jeu</label>
              <select
                value={formData.expectedDay}
                onChange={(e) => setFormData({ ...formData, expectedDay: e.target.value as 'Samedi' | 'Dimanche' })}
                className="w-full bg-[#0b0e14] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="Dimanche">Dimanche (Seniors & Vétérans)</option>
                <option value="Samedi">Samedi (Jeunes)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Joueurs min requis</label>
              <input
                type="number"
                min={1}
                max={6}
                value={formData.minPlayers}
                onChange={(e) => setFormData({ ...formData, minPlayers: parseInt(e.target.value, 10) || 1 })}
                className="w-full bg-[#0b0e14] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Joueurs max autorisés</label>
              <input
                type="number"
                min={2}
                max={8}
                value={formData.maxPlayers}
                onChange={(e) => setFormData({ ...formData, maxPlayers: parseInt(e.target.value, 10) || 6 })}
                className="w-full bg-[#0b0e14] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Système de points & Ordre officiel */}
          <div className="space-y-3">
            <div>
              <label className="font-bold text-zinc-300 block mb-1">Système de points en jeu</label>
              <input
                type="text"
                value={formData.pointsSystem}
                onChange={(e) => setFormData({ ...formData, pointsSystem: e.target.value })}
                placeholder="Ex: 4 simples (1 pt chacun) + 2 doubles (1 pt chacun) = 6 points"
                className="w-full bg-[#0b0e14] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-bold text-zinc-300 block mb-1">Ordre de passage officiel</label>
              <input
                type="text"
                value={formData.orderOfPlay}
                onChange={(e) => setFormData({ ...formData, orderOfPlay: e.target.value })}
                placeholder="Ex: 4-2, 3-1, doubles sur 2 courts"
                className="w-full bg-[#0b0e14] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="font-bold text-zinc-300 block mb-1">Notes et règles particulières (Comité 56 / Bretagne)</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Précisions sur les balles, tie-breaks, accords préalables..."
                className="w-full bg-[#0b0e14] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Pied de formulaire */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold transition flex items-center gap-1.5 cursor-pointer text-xs"
              title="Rétablir le format FFT officiel"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rétablir FFT 2027</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition cursor-pointer text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white font-black transition flex items-center gap-1.5 shadow-lg shadow-orange-950/40 cursor-pointer text-xs"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les modifications</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
