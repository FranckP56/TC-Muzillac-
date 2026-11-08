import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scale, 
  Search, 
  Filter, 
  Edit3, 
  RotateCcw, 
  Download, 
  Upload, 
  Check, 
  Calendar, 
  Clock, 
  Users, 
  Shield, 
  Layers, 
  AlertTriangle, 
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';
import { ChampionshipRule } from '../types/rules';
import { UserRole } from '../types/tennis';
import { 
  getStoredChampionshipRules, 
  saveChampionshipRule, 
  resetSingleRule, 
  resetAllChampionshipRules,
  exportRulesToJson,
  importRulesFromJson
} from '../utils/rulesManager';
import { EditRuleModal } from './EditRuleModal';

interface ReglementsTabProps {
  userRole?: UserRole;
}

export const ReglementsTab: React.FC<ReglementsTabProps> = ({
  userRole = 'adherent',
}) => {
  const [rules, setRules] = useState<ChampionshipRule[]>(() => getStoredChampionshipRules());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSexe, setFilterSexe] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [selectedRuleToEdit, setSelectedRuleToEdit] = useState<ChampionshipRule | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canEdit = userRole === 'admin' || userRole === 'bureau';

  // Synchronisation des événements de mise à jour des règles
  useEffect(() => {
    const handleRulesUpdated = () => {
      setRules(getStoredChampionshipRules());
    };
    window.addEventListener('tcm_rules_updated', handleRulesUpdated);
    return () => window.removeEventListener('tcm_rules_updated', handleRulesUpdated);
  }, []);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleSaveRule = (updatedRule: ChampionshipRule) => {
    const newRules = saveChampionshipRule(updatedRule);
    setRules(newRules);
    showNotification(`Règlement « ${updatedRule.title} » mis à jour avec succès.`);
  };

  const handleResetSingle = (ruleId: string) => {
    const newRules = resetSingleRule(ruleId);
    setRules(newRules);
    showNotification('Règlement rétabli au standard officiel FFT 2027.');
  };

  const handleResetAll = () => {
    if (window.confirm('Voulez-vous réinitialiser TOUS les règlements aux valeurs FFT 2027 d\'origine ?')) {
      const newRules = resetAllChampionshipRules();
      setRules(newRules);
      showNotification('Tous les règlements ont été réinitialisés aux valeurs officielles FFT 2027.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importRulesFromJson(content);
        if (res.success) {
          setRules(getStoredChampionshipRules());
          showNotification(`${res.count || 0} règlements importés avec succès.`);
        } else {
          alert('Erreur lors de l\'importation : ' + res.error);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtrage multi-critères
  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      // 1. Recherche texte
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          r.title.toLowerCase().includes(q) ||
          r.division.toLowerCase().includes(q) ||
          r.singlesGameFormat.toLowerCase().includes(q) ||
          r.doublesGameFormat.toLowerCase().includes(q) ||
          r.orderOfPlay.toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 2. Filtre Catégorie
      if (filterCategory !== 'all') {
        if (filterCategory === 'seniors' && !r.categoryAge.includes('Seniors')) return false;
        if (filterCategory === 'seniors_plus' && !r.categoryAge.includes('+')) return false;
        if (filterCategory === 'jeunes' && (!r.categoryAge.includes('Jeunes') && !r.categoryAge.includes('10'))) return false;
      }

      // 3. Filtre Sexe
      if (filterSexe !== 'all') {
        if (filterSexe === 'H' && r.sexe !== 'Messieurs' && r.sexe !== 'Tous') return false;
        if (filterSexe === 'F' && r.sexe !== 'Dames' && r.sexe !== 'Tous') return false;
      }

      // 4. Filtre Niveau
      if (filterLevel !== 'all') {
        if (r.level !== filterLevel) return false;
      }

      return true;
    });
  }, [rules, searchQuery, filterCategory, filterSexe, filterLevel]);

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Notification Toast */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-zinc-950 font-black px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 border-2 border-emerald-300 animate-slideUp">
          <CheckCircle2 className="w-5 h-5 text-zinc-950 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* En-tête de section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black font-heading text-white">
              Règlements & Formats des Championnats
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500/20 text-[#FF6D00] border border-orange-500/30">
              FFT & Bretagne 2027
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Consultez et ajustez le nombre de simples, de doubles, les formats de jeu et les ordres de passage pour chaque catégorie.
            {canEdit && (
              <strong className="text-orange-400 block mt-0.5">
                Mode Administrateur : Vous pouvez modifier chaque format sans modifier le code pour les prochaines saisons.
              </strong>
            )}
          </p>
        </div>

        {/* Toolbar Administrateur */}
        {canEdit && (
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <label className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-zinc-700 shadow-sm">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Importer JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>

            <button
              onClick={exportRulesToJson}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-zinc-700 shadow-sm"
              title="Exporter les règles au format JSON pour sauvegarde"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exporter JSON</span>
            </button>

            <button
              onClick={handleResetAll}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-zinc-700"
              title="Rétablir les règles d'origine FFT 2027"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Rétablir tout FFT</span>
            </button>
          </div>
        )}
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-[#141820] p-4 rounded-2xl border border-[#252b37] space-y-3 text-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre, division, format, simples..."
              className="w-full bg-[#0d1016] border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0">
            {/* Filtre Catégorie */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#0d1016] border border-zinc-800 text-white text-xs focus:border-[#FF6D00] outline-none cursor-pointer"
            >
              <option value="all">Toutes catégories</option>
              <option value="seniors">Seniors</option>
              <option value="seniors_plus">Seniors+ (+35, +45...)</option>
              <option value="jeunes">Jeunes (Galaxie & 11-18)</option>
            </select>

            {/* Filtre Sexe */}
            <select
              value={filterSexe}
              onChange={(e) => setFilterSexe(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#0d1016] border border-zinc-800 text-white text-xs focus:border-[#FF6D00] outline-none cursor-pointer"
            >
              <option value="all">Tous sexes</option>
              <option value="H">Messieurs</option>
              <option value="F">Dames</option>
            </select>

            {/* Filtre Niveau */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#0d1016] border border-zinc-800 text-white text-xs focus:border-[#FF6D00] outline-none cursor-pointer"
            >
              <option value="all">Tous niveaux</option>
              <option value="Régional">Régional & PR</option>
              <option value="Départemental">Départemental</option>
              <option value="Galaxie">Galaxie</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grille des formats de championnats */}
      {filteredRules.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRules.map((r) => {
            const isFemme = r.sexe === 'Dames';
            const isRegional = r.level === 'Régional';
            const isJeunes = r.categoryAge.toLowerCase().includes('jeune') || r.categoryAge.toLowerCase().includes('10');

            const cardHeaderBorder = isFemme 
              ? 'border-pink-500/40 bg-[#1f1022]' 
              : isRegional
                ? 'border-orange-500/40 bg-[#1f1610]'
                : isJeunes
                  ? 'border-emerald-500/40 bg-[#101f18]'
                  : 'border-blue-500/40 bg-[#101822]';

            return (
              <div
                key={r.id}
                className="bg-[#141820] rounded-3xl border border-[#252b37] overflow-hidden flex flex-col justify-between shadow-lg hover:border-zinc-700 transition"
              >
                {/* En-tête de carte */}
                <div className={`p-4 border-b ${cardHeaderBorder}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          r.level === 'Régional'
                            ? 'bg-orange-500/20 text-[#FF6D00] border border-orange-500/40'
                            : r.level === 'Galaxie'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}>
                          {r.level}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          r.sexe === 'Dames'
                            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                            : r.sexe === 'Messieurs'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        }`}>
                          {r.sexe}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/40 text-zinc-300 border border-zinc-700">
                          {r.categoryAge}
                        </span>

                        {r.isCustomized && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            Personnalisé
                          </span>
                        )}
                      </div>

                      <h3 className="font-heading font-black text-white text-base">
                        {r.title}
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        Division : <strong className="text-zinc-200">{r.division}</strong>
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-black/50 text-orange-300 border border-orange-500/30 shrink-0">
                      📅 {r.expectedDay}
                    </span>
                  </div>
                </div>

                {/* Corps de carte */}
                <div className="p-4 space-y-3.5 text-xs">
                  
                  {/* Grille Simples / Doubles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    
                    {/* Bloc Simples */}
                    <div className="p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">
                          Épreuve de Simples
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-orange-500/15 text-[#FF6D00] border border-orange-500/30 font-black font-mono text-xs">
                          {r.numSingles} Simples
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-tight">
                        {r.singlesGameFormat}
                      </p>
                    </div>

                    {/* Bloc Doubles */}
                    <div className="p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">
                          Épreuve de Doubles
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 font-black font-mono text-xs">
                          {r.numDoubles} Double{r.numDoubles > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-tight">
                        {r.doublesGameFormat}
                      </p>
                      {r.doubleWeightStrict && (
                        <p className="text-[10px] font-bold text-amber-300 flex items-center gap-1 pt-0.5">
                          <span>⚖️ Règle Poids D1 ≥ D2 obligatoire</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Logistique, Déroulement & Points */}
                  <div className="bg-[#0e121a] p-3 rounded-2xl border border-zinc-800/80 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Composition d'équipe :</span>
                        <strong className="text-white">{r.minPlayers} à {r.maxPlayers} joueurs</strong>
                      </span>
                      <span className="text-zinc-300 font-bold bg-black/40 px-2 py-0.5 rounded border border-zinc-800">
                        {r.pointsSystem}
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-zinc-800/60">
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold">Ordre officiel des parties :</span>
                      <p className="text-zinc-200 mt-0.5 font-medium">{r.orderOfPlay}</p>
                    </div>

                    {r.notes && (
                      <div className="pt-1.5 border-t border-zinc-800/60 text-zinc-400 text-[10px] italic">
                        📌 {r.notes}
                      </div>
                    )}

                    {r.updatedAt && (
                      <p className="text-[9px] text-zinc-500 text-right">
                        Modifié le {r.updatedAt}
                      </p>
                    )}
                  </div>
                </div>

                {/* Pied de carte avec actions Admin */}
                <div className="p-3 bg-[#0d1016] border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-500">
                    ID : <code className="font-mono">{r.id}</code>
                  </span>

                  {canEdit ? (
                    <div className="flex items-center space-x-2">
                      {r.isCustomized && (
                        <button
                          onClick={() => handleResetSingle(r.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Rétablir ce championnat aux règles officielles FFT 2027"
                        >
                          <RotateCcw className="w-3 h-3 text-rose-400" />
                          <span>Rétablir</span>
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedRuleToEdit(r)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Modifier ce format</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Règlement officiel en vigueur</span>
                    </span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-[#141820] rounded-3xl border border-[#252b37] max-w-md mx-auto">
          <Scale className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="font-heading font-black text-white text-base">Aucun règlement trouvé</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Aucun championnat ne correspond à votre recherche.
          </p>
        </div>
      )}

      {/* Modale d'édition d'une règle (Admin / Bureau) */}
      {selectedRuleToEdit && (
        <EditRuleModal
          isOpen={!!selectedRuleToEdit}
          rule={selectedRuleToEdit}
          onClose={() => setSelectedRuleToEdit(null)}
          onSave={handleSaveRule}
          onReset={handleResetSingle}
        />
      )}

    </div>
  );
};
