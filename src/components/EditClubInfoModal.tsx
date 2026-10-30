import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Building, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  GraduationCap, 
  Shield, 
  Clock, 
  Layers, 
  Euro, 
  Check,
  Tag,
  CreditCard,
  ExternalLink,
  Upload,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { ClubInfo, Enseignant, ClubTarif } from '../types/tennis';
import { getAccessToken, googleSignIn } from '../services/auth';
import { saveClubInfoToSheet, TCM_DEFAULT_SHEET_ID } from '../services/googleSheets';

interface EditClubInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubInfo: ClubInfo;
  onSave: (updatedInfo: ClubInfo) => void;
  selectedSpreadsheetId?: string | null;
}

// Fonction de salubrité : corrige automatiquement les tarifs mal étiquetés 'jeune' alors qu'ils mentionnent adulte/adhésion
const sanitizeClubTarifs = (tarifs?: ClubTarif[]): ClubTarif[] => {
  if (!tarifs || tarifs.length === 0) return [];
  return tarifs.map(t => {
    if (t.categorie === 'jeune' && /adulte|senior|majeur/i.test(t.label)) {
      return { 
        ...t, 
        categorie: /adh[eé]sion/i.test(t.label) && !/cours|collectif|entrain/i.test(t.label) 
          ? 'adhesion' 
          : 'adulte' 
      };
    }
    return t;
  });
};

export const EditClubInfoModal: React.FC<EditClubInfoModalProps> = ({
  isOpen,
  onClose,
  clubInfo,
  onSave,
  selectedSpreadsheetId,
}) => {
  const [isPushingToGsheet, setIsPushingToGsheet] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [formData, setFormData] = useState<ClubInfo>(() => ({
    ...clubInfo,
    enseignants: clubInfo.enseignants && clubInfo.enseignants.length > 0 
      ? [...clubInfo.enseignants] 
      : [
          {
            id: 'prof-1',
            nomPrenom: clubInfo.enseignant || 'Alexandre Rault',
            diplome: 'Diplômé d\'État (DE)',
            telephone: '06 12 34 56 78',
            email: 'alexandre.rault.tennis@gmail.com',
            description: 'Responsable pédagogique, compétition et cours adultes.',
          },
          {
            id: 'prof-2',
            nomPrenom: 'Thomas Mercier',
            diplome: 'BPJEPS Tennis',
            telephone: '06 98 76 54 32',
            email: 'thomas.mercier.tennis@gmail.com',
            description: 'Enseignant Galaxie Tennis et perfectionnement jeunes.',
          }
        ],
    installations: [...clubInfo.installations],
    tarifs: sanitizeClubTarifs(clubInfo.tarifs),
    horairesPermanence: clubInfo.horairesPermanence || 'Mercredi 14h-18h et Samedi 10h-12h au Club-house',
    modalitesPaiement: clubInfo.modalitesPaiement || "Paiement échelonné possible par chèque et par CB via HelloAsso (directement sur Ten'Up avec le montant dans votre panier). Chèques vacances ANCV et Pass'Sport acceptés.",
  }));

  // Synchronisation et assainissement automatique à l'ouverture du modal
  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...clubInfo,
        enseignants: clubInfo.enseignants && clubInfo.enseignants.length > 0 
          ? [...clubInfo.enseignants] 
          : [
              {
                id: 'prof-1',
                nomPrenom: clubInfo.enseignant || 'Alexandre Rault',
                diplome: 'Diplômé d\'État (DE)',
                telephone: '06 12 34 56 78',
                email: 'alexandre.rault.tennis@gmail.com',
                description: 'Responsable pédagogique, compétition et cours adultes.',
              },
              {
                id: 'prof-2',
                nomPrenom: 'Thomas Mercier',
                diplome: 'BPJEPS Tennis',
                telephone: '06 98 76 54 32',
                email: 'thomas.mercier.tennis@gmail.com',
                description: 'Enseignant Galaxie Tennis et perfectionnement jeunes.',
              }
            ],
        installations: [...clubInfo.installations],
        tarifs: sanitizeClubTarifs(clubInfo.tarifs),
        horairesPermanence: clubInfo.horairesPermanence || 'Mercredi 14h-18h et Samedi 10h-12h au Club-house',
        modalitesPaiement: clubInfo.modalitesPaiement || "Paiement échelonné possible par chèque et par CB via HelloAsso (directement sur Ten'Up avec le montant dans votre panier). Chèques vacances ANCV et Pass'Sport acceptés.",
      });
    }
  }, [isOpen, clubInfo]);

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'bureau' | 'enseignants' | 'installations' | 'tarifs'>('tarifs');
  const [successSaved, setSuccessSaved] = useState(false);

  // New item states
  const [newEnseignantNom, setNewEnseignantNom] = useState('');
  const [newEnseignantDiplome, setNewEnseignantDiplome] = useState('Diplômé d\'État (DE)');
  const [newEnseignantTel, setNewEnseignantTel] = useState('');
  const [newEnseignantEmail, setNewEnseignantEmail] = useState('');
  const [newEnseignantDesc, setNewEnseignantDesc] = useState('');

  const [newInstallation, setNewInstallation] = useState('');
  const [newTarifLabel, setNewTarifLabel] = useState('');
  const [newTarifMontant, setNewTarifMontant] = useState<number>(150);
  const [newTarifCat, setNewTarifCat] = useState<'jeune' | 'adulte' | 'competition' | 'adhesion'>('adulte');
  const [newTarifDesc, setNewTarifDesc] = useState('');

  if (!isOpen) return null;

  const handleAddEnseignant = () => {
    if (!newEnseignantNom.trim()) return;
    const newEns: Enseignant = {
      id: `prof-${Date.now()}`,
      nomPrenom: newEnseignantNom.trim(),
      diplome: newEnseignantDiplome,
      telephone: newEnseignantTel.trim(),
      email: newEnseignantEmail.trim(),
      description: newEnseignantDesc.trim() || undefined,
    };
    setFormData(prev => ({
      ...prev,
      enseignants: [...prev.enseignants, newEns],
    }));
    setNewEnseignantNom('');
    setNewEnseignantTel('');
    setNewEnseignantEmail('');
    setNewEnseignantDesc('');
  };

  const handleRemoveEnseignant = (id: string) => {
    setFormData(prev => ({
      ...prev,
      enseignants: prev.enseignants.filter(e => e.id !== id),
    }));
  };

  const handleAddInstallation = () => {
    if (!newInstallation.trim()) return;
    setFormData(prev => ({
      ...prev,
      installations: [...prev.installations, newInstallation.trim()],
    }));
    setNewInstallation('');
  };

  const handleRemoveInstallation = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      installations: prev.installations.filter((_, i) => i !== idx),
    }));
  };

  // Détection intelligente de la catégorie de tarif au fur et à mesure de la frappe
  const handleTarifLabelChange = (val: string) => {
    setNewTarifLabel(val);
    const lower = val.toLowerCase();
    if (lower.includes('adulte') || lower.includes('senior') || lower.includes('majeur')) {
      setNewTarifCat('adulte');
    } else if (lower.includes('adhésion') || lower.includes('adhesion') || lower.includes('libre') || lower.includes('badge')) {
      setNewTarifCat('adhesion');
    } else if (lower.includes('compétition') || lower.includes('competition') || lower.includes('tournoi') || lower.includes('équipe') || lower.includes('equipe')) {
      setNewTarifCat('competition');
    } else if (lower.includes('jeune') || lower.includes('galaxie') || lower.includes('ado') || lower.includes('enfant') || lower.includes('mini') || lower.includes('école') || lower.includes('ecole')) {
      setNewTarifCat('jeune');
    }
  };

  const handleAddTarif = () => {
    if (!newTarifLabel.trim()) return;
    const newT: ClubTarif = {
      id: `tarif-${Date.now()}`,
      label: newTarifLabel.trim(),
      montant: Number(newTarifMontant) || 0,
      categorie: newTarifCat,
      description: newTarifDesc.trim() || undefined,
    };
    setFormData(prev => ({
      ...prev,
      tarifs: [...(prev.tarifs || []), newT],
    }));
    setNewTarifLabel('');
    setNewTarifDesc('');
    setNewTarifMontant(150);
  };

  const handleUpdateTarifCategory = (id: string, newCat: 'jeune' | 'adulte' | 'competition' | 'adhesion') => {
    setFormData(prev => ({
      ...prev,
      tarifs: (prev.tarifs || []).map(t => t.id === id ? { ...t, categorie: newCat } : t),
    }));
  };

  const handleUpdateTarifLabel = (id: string, newLabel: string) => {
    setFormData(prev => ({
      ...prev,
      tarifs: (prev.tarifs || []).map(t => t.id === id ? { ...t, label: newLabel } : t),
    }));
  };

  const handleUpdateTarifMontant = (id: string, newMontant: number) => {
    setFormData(prev => ({
      ...prev,
      tarifs: (prev.tarifs || []).map(t => t.id === id ? { ...t, montant: newMontant } : t),
    }));
  };

  const handleUpdateTarifDescription = (id: string, newDesc: string) => {
    setFormData(prev => ({
      ...prev,
      tarifs: (prev.tarifs || []).map(t => t.id === id ? { ...t, description: newDesc } : t),
    }));
  };

  const handleRemoveTarif = (id: string) => {
    setFormData(prev => ({
      ...prev,
      tarifs: (prev.tarifs || []).filter(t => t.id !== id),
    }));
  };

  const handleSave = () => {
    onSave(formData);
    setSuccessSaved(true);
    setTimeout(() => {
      setSuccessSaved(false);
      onClose();
    }, 800);
  };

  const handlePushToGoogleSheets = async () => {
    setIsPushingToGsheet(true);
    setPushStatusMessage(null);
    try {
      const sanitized = {
        ...formData,
        tarifs: sanitizeClubTarifs(formData.tarifs),
      };
      // 1. Sauvegarde locale immédiate
      onSave(sanitized);

      // 2. Récupération ou demande du token OAuth Google
      let token = await getAccessToken();
      if (!token) {
        setPushStatusMessage({
          type: 'info',
          text: 'Connexion Google requise. Veuillez sélectionner votre compte dans la fenêtre...',
        });
        const authRes = await googleSignIn();
        if (authRes && authRes.accessToken) {
          token = authRes.accessToken;
        } else {
          setPushStatusMessage({
            type: 'error',
            text: 'Connexion Google annulée. Les données restent sauvegardées en local.',
          });
          setIsPushingToGsheet(false);
          return;
        }
      }

      setPushStatusMessage({
        type: 'info',
        text: 'Écriture en cours dans les onglets Bureau_Profs, Installations et Cotisations_Tarifs...',
      });

      const res = await saveClubInfoToSheet(sanitized, selectedSpreadsheetId || TCM_DEFAULT_SHEET_ID, token);
      if (res.success) {
        setPushStatusMessage({
          type: 'success',
          text: '✓ Vos données réelles ont été écrites avec succès dans votre Google Sheet !',
        });
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setPushStatusMessage({
          type: 'error',
          text: `Erreur d'écriture : ${res.error || 'Vérifiez les permissions de votre fichier'}`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setPushStatusMessage({
        type: 'error',
        text: `Erreur : ${err.message || "Échec d'écriture Google Sheets"}`,
      });
    } finally {
      setIsPushingToGsheet(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#141820] border border-[#272e3b] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#232934] bg-[#11141a]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#BF360C] to-[#FF6D00] text-white flex items-center justify-center font-bold shadow-lg shadow-orange-950/50">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-black text-white">
                Modifier les Données du Club
              </h2>
              <p className="text-xs text-zinc-400">
                Enseignants (DE & BPJEPS), Bureau, Terrains & Tarifs du Tennis Club de Muzillac
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs navigation */}
        <div className="flex items-center px-4 sm:px-6 pt-3 border-b border-[#232934] bg-[#0f1218] gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveSubTab('enseignants')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'enseignants'
                ? 'border-[#FF6D00] text-[#FF6D00]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Enseignants ({formData.enseignants.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('bureau')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'bureau'
                ? 'border-[#FF6D00] text-[#FF6D00]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Bureau & Contacts</span>
          </button>

          <button
            onClick={() => setActiveSubTab('installations')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'installations'
                ? 'border-[#FF6D00] text-[#FF6D00]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Installations ({formData.installations.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tarifs')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'tarifs'
                ? 'border-[#FF6D00] text-[#FF6D00]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Euro className="w-4 h-4" />
            <span>Tarifs & Cotisations ({formData.tarifs?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('general')}
            className={`px-3 py-2 border-b-2 font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'general'
                ? 'border-[#FF6D00] text-[#FF6D00]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Club & Coordonnées</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          
          {/* ==================== ONGLET ENSEIGNANTS ==================== */}
          {activeSubTab === 'enseignants' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-orange-500/10 rounded-2xl border border-orange-500/30 flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-[#FF6D00] shrink-0" />
                <p className="text-xs text-orange-200">
                  Le TCM dispose actuellement de <strong>2 enseignants qualifiés</strong> : un Diplômé d'État (DE) et un diplômé BPJEPS. Vous pouvez modifier leurs coordonnées ou en ajouter d'autres ci-dessous.
                </p>
              </div>

              {/* Liste des enseignants actuels */}
              <div className="space-y-3">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                  Enseignants enregistrés ({formData.enseignants.length})
                </h3>

                {formData.enseignants.map((ens) => (
                  <div 
                    key={ens.id}
                    className="p-3.5 bg-[#171b23] rounded-2xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-black text-white text-sm">
                          {ens.nomPrenom}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          ens.diplome.includes('DE') || ens.diplome.includes('État')
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {ens.diplome}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                        {ens.telephone && (
                          <span className="flex items-center gap-1 text-zinc-300">
                            <Phone className="w-3 h-3 text-[#FF6D00]" />
                            {ens.telephone}
                          </span>
                        )}
                        {ens.email && (
                          <span className="flex items-center gap-1 text-zinc-300">
                            <Mail className="w-3 h-3 text-[#FF6D00]" />
                            {ens.email}
                          </span>
                        )}
                      </div>
                      {ens.description && (
                        <p className="text-[11px] text-zinc-400">{ens.description}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveEnseignant(ens.id)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition self-end sm:self-center cursor-pointer"
                      title="Supprimer cet enseignant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Formulaire d'ajout d'enseignant */}
              <div className="p-4 bg-[#11141a] rounded-2xl border border-zinc-800 space-y-3">
                <h4 className="font-bold text-white text-xs flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#FF6D00]" />
                  <span>Ajouter un enseignant</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Nom et Prénom *</label>
                    <input
                      type="text"
                      value={newEnseignantNom}
                      onChange={(e) => setNewEnseignantNom(e.target.value)}
                      placeholder="Ex: Alexandre Rault"
                      className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Diplôme officiel FFT / Jeunesse & Sports *</label>
                    <select
                      value={newEnseignantDiplome}
                      onChange={(e) => setNewEnseignantDiplome(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                    >
                      <option value="Diplômé d'État (DE)">Diplômé d'État (DE Tennis)</option>
                      <option value="BPJEPS Tennis">BPJEPS Tennis</option>
                      <option value="DESJEPS Tennis">DESJEPS Tennis (Haut niveau)</option>
                      <option value="CQP Éducateur Tennis (CQP ET)">CQP Éducateur Tennis</option>
                      <option value="Initiateur Fédéral">Initiateur Fédéral</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Téléphone portable</label>
                    <input
                      type="text"
                      value={newEnseignantTel}
                      onChange={(e) => setNewEnseignantTel(e.target.value)}
                      placeholder="06 XX XX XX XX"
                      className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Adresse Email</label>
                    <input
                      type="email"
                      value={newEnseignantEmail}
                      onChange={(e) => setNewEnseignantEmail(e.target.value)}
                      placeholder="prof@tennisclubmuzillac.fr"
                      className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-zinc-400 block mb-1">Rôle / Spécialité</label>
                    <input
                      type="text"
                      value={newEnseignantDesc}
                      onChange={(e) => setNewEnseignantDesc(e.target.value)}
                      placeholder="Ex: Responsable École de Tennis, Galaxie, Compétition..."
                      className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddEnseignant}
                  disabled={!newEnseignantNom.trim()}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enregistrer cet enseignant</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== ONGLET BUREAU ==================== */}
          {activeSubTab === 'bureau' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {/* 1. Président */}
                <div className="p-3 bg-[#11141a] rounded-2xl border border-zinc-800 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FF6D00] bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                    Président du club
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Nom et Prénom *</label>
                      <input
                        type="text"
                        value={formData.president}
                        onChange={(e) => setFormData({ ...formData, president: e.target.value })}
                        placeholder="Ex: Laurent Le Guennec"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Portable</label>
                      <input
                        type="text"
                        value={formData.presidentTelephone || ''}
                        onChange={(e) => setFormData({ ...formData, presidentTelephone: e.target.value })}
                        placeholder="Ex: 06 82 45 19 33"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.presidentEmail || ''}
                        onChange={(e) => setFormData({ ...formData, presidentEmail: e.target.value })}
                        placeholder="Ex: president.tcmuzillac@gmail.com"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Secrétaire */}
                <div className="p-3 bg-[#11141a] rounded-2xl border border-zinc-800 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                    Secrétaire
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Nom et Prénom *</label>
                      <input
                        type="text"
                        value={formData.secretaire}
                        onChange={(e) => setFormData({ ...formData, secretaire: e.target.value })}
                        placeholder="Ex: Sophie Bourdon"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Portable</label>
                      <input
                        type="text"
                        value={formData.secretaireTelephone || ''}
                        onChange={(e) => setFormData({ ...formData, secretaireTelephone: e.target.value })}
                        placeholder="Ex: 06 74 12 88 50"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.secretaireEmail || ''}
                        onChange={(e) => setFormData({ ...formData, secretaireEmail: e.target.value })}
                        placeholder="Ex: secretariat.tcmuzillac@gmail.com"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Trésorier */}
                <div className="p-3 bg-[#11141a] rounded-2xl border border-zinc-800 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Trésorier
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Nom et Prénom *</label>
                      <input
                        type="text"
                        value={formData.tresorier}
                        onChange={(e) => setFormData({ ...formData, tresorier: e.target.value })}
                        placeholder="Ex: Philippe Conan"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Portable</label>
                      <input
                        type="text"
                        value={formData.tresorierTelephone || ''}
                        onChange={(e) => setFormData({ ...formData, tresorierTelephone: e.target.value })}
                        placeholder="Ex: 06 63 90 24 17"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.tresorierEmail || ''}
                        onChange={(e) => setFormData({ ...formData, tresorierEmail: e.target.value })}
                        placeholder="Ex: tresorerie.tcmuzillac@gmail.com"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Permanences au club-house</label>
                <input
                  type="text"
                  value={formData.horairesPermanence || ''}
                  onChange={(e) => setFormData({ ...formData, horairesPermanence: e.target.value })}
                  placeholder="Ex: Mercredi 14h-18h et Samedi 10h-12h"
                  className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
              </div>
            </div>
          )}

          {/* ==================== ONGLET INSTALLATIONS ==================== */}
          {activeSubTab === 'installations' && (
            <div className="space-y-4">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                Installations & Terrains enregistrés
              </h3>

              <div className="space-y-2">
                {formData.installations.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#171b23] rounded-xl border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-zinc-200">{item}</span>
                    <button
                      onClick={() => handleRemoveInstallation(idx)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newInstallation}
                  onChange={(e) => setNewInstallation(e.target.value)}
                  placeholder="Ex: 2 courts couverts résine au Clos des Moines..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddInstallation}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== ONGLET TARIFS ==================== */}
          {activeSubTab === 'tarifs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                    Grille des Tarifs & Cotisations ({formData.tarifs?.length || 0})
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Modifiez la pastille/catégorie de chaque formule ci-dessous ou ajoutez-en de nouvelles.
                  </p>
                </div>
              </div>

              {/* Liste des tarifs existants avec modification directe de la catégorie et du montant */}
              <div className="space-y-2.5">
                {(formData.tarifs || []).map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-[#171b23] rounded-2xl border border-zinc-800 space-y-2 text-xs transition hover:border-zinc-700"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1 flex items-center gap-2">
                        {/* Sélecteur de catégorie / pastille en ligne */}
                        <select
                          value={t.categorie}
                          onChange={(e) => handleUpdateTarifCategory(t.id, e.target.value as any)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-black border outline-none cursor-pointer shrink-0 transition ${
                            t.categorie === 'adulte'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                              : t.categorie === 'adhesion'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                              : t.categorie === 'competition'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          }`}
                          title="Modifier la pastille/catégorie de ce tarif"
                        >
                          <option value="adulte" className="bg-[#171b23] text-sky-300">● Adulte (Bleu)</option>
                          <option value="adhesion" className="bg-[#171b23] text-purple-300">● Adhésion seule (Violet)</option>
                          <option value="jeune" className="bg-[#171b23] text-emerald-300">● Jeune (Vert)</option>
                          <option value="competition" className="bg-[#171b23] text-amber-300">● Compétition (Orange)</option>
                        </select>

                        {/* Intitulé éditable */}
                        <input
                          type="text"
                          value={t.label}
                          onChange={(e) => handleUpdateTarifLabel(t.id, e.target.value)}
                          placeholder="Intitulé de la formule"
                          className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-zinc-750 font-bold text-white text-xs focus:border-[#FF6D00] outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <div className="flex items-center gap-1 bg-black/40 border border-zinc-750 rounded-xl px-2.5 py-1.5">
                          <input
                            type="number"
                            value={t.montant}
                            onChange={(e) => handleUpdateTarifMontant(t.id, Number(e.target.value))}
                            className="w-16 bg-transparent text-right font-heading font-black text-orange-400 text-xs focus:outline-none"
                          />
                          <span className="text-zinc-400 font-bold text-xs">€</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveTarif(t.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                          title="Supprimer ce tarif"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Description optionnelle */}
                    <div>
                      <input
                        type="text"
                        value={t.description || ''}
                        onChange={(e) => handleUpdateTarifDescription(t.id, e.target.value)}
                        placeholder="Précisions (ex: Licence FFT incluse, accès courts libre 7j/7...)"
                        className="w-full px-3 py-1.5 rounded-xl bg-black/20 border border-zinc-800 text-zinc-400 text-[11px] focus:border-zinc-600 outline-none placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulaire d'ajout d'un nouveau tarif */}
              <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800 space-y-3 pt-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    <span>Ajouter une nouvelle formule</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 hidden sm:inline">
                    La pastille s'ajuste automatiquement selon le texte saisi
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5">
                    <label className="text-[10px] text-zinc-400 block mb-1">Intitulé de la formule *</label>
                    <input
                      type="text"
                      value={newTarifLabel}
                      onChange={(e) => handleTarifLabelChange(e.target.value)}
                      placeholder="Ex: Adhésion adulte, Cotisation jeune..."
                      className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="text-[10px] text-zinc-400 block mb-1">Catégorie / Pastille *</label>
                    <select
                      value={newTarifCat}
                      onChange={(e) => setNewTarifCat(e.target.value as any)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                        newTarifCat === 'adulte'
                          ? 'bg-sky-950/40 border-sky-500/50 text-sky-300'
                          : newTarifCat === 'adhesion'
                          ? 'bg-purple-950/40 border-purple-500/50 text-purple-300'
                          : newTarifCat === 'competition'
                          ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                          : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      }`}
                    >
                      <option value="adulte" className="bg-[#171b23] text-sky-300">● Adulte (Pastille bleue)</option>
                      <option value="adhesion" className="bg-[#171b23] text-purple-300">● Adhésion seule (Pastille violette)</option>
                      <option value="jeune" className="bg-[#171b23] text-emerald-300">● Jeune (Pastille verte)</option>
                      <option value="competition" className="bg-[#171b23] text-amber-300">● Compétition (Pastille orange)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[10px] text-zinc-400 block mb-1">Montant en € *</label>
                    <input
                      type="number"
                      value={newTarifMontant}
                      onChange={(e) => setNewTarifMontant(Number(e.target.value))}
                      placeholder="Montant en €"
                      className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-9">
                    <input
                      type="text"
                      value={newTarifDesc}
                      onChange={(e) => setNewTarifDesc(e.target.value)}
                      placeholder="Précisions optionnelles (ex: Licence FFT incluse, accès aux courts libres 7j/7)"
                      className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddTarif}
                      className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-orange-950/40"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ajouter ce tarif</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ================= MODALITÉS DE RÈGLEMENT & PAIEMENT ÉCHELONNÉ ================= */}
              <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800 space-y-3 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                      Modalités & Facilités de paiement
                    </h4>
                    <p className="text-[10px] text-zinc-400">
                      Texte affiché sous la grille des cotisations (Paiement échelonné par chèque, CB via HelloAsso...)
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">
                    Texte des facilités de paiement (Chèques, CB HelloAsso, échelonnement...) *
                  </label>
                  <textarea
                    rows={2}
                    value={formData.modalitesPaiement || ''}
                    onChange={(e) => setFormData({ ...formData, modalitesPaiement: e.target.value })}
                    placeholder="Ex: Paiement échelonné possible par chèque et par CB via HelloAsso. Chèques vacances ANCV et Pass'Sport acceptés."
                    className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">
                      Lien direct HelloAsso du club (optionnel)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={formData.helloAssoUrl || ''}
                        onChange={(e) => setFormData({ ...formData, helloAssoUrl: e.target.value })}
                        placeholder="https://www.helloasso.com/associations/tennis-club-muzillac"
                        className="flex-1 px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                      />
                      {formData.helloAssoUrl && (
                        <a
                          href={formData.helloAssoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition shrink-0"
                          title="Ouvrir le lien HelloAsso"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        modalitesPaiement: "Paiement échelonné possible par chèque et par CB via HelloAsso. Chèques vacances ANCV et Pass'Sport acceptés.",
                        helloAssoUrl: prev.helloAssoUrl || "https://www.helloasso.com/associations/tennis-club-muzillac"
                      }))}
                      className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Restaurer formule standard (Chèque + HelloAsso)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== ONGLET GENERAL ==================== */}
          {activeSubTab === 'general' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Nom Officiel du Club *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Code Club FFT *</label>
                <input
                  type="text"
                  value={formData.codeClub}
                  onChange={(e) => setFormData({ ...formData, codeClub: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] text-zinc-400 block mb-1">Adresse des Installations *</label>
                <input
                  type="text"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Code Postal *</label>
                <input
                  type="text"
                  value={formData.codePostal}
                  onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Ville *</label>
                <input
                  type="text"
                  value={formData.ville}
                  onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Téléphone Club</label>
                <input
                  type="text"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Email Club</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                />
              </div>
            </div>
          )}

        </div>

        {/* Message d'état pour la synchronisation Google Sheets */}
        {pushStatusMessage && (
          <div className={`mx-4 sm:mx-6 mb-3 p-3 rounded-2xl text-xs flex items-center space-x-2 border animate-fadeIn ${
            pushStatusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : pushStatusMessage.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              : 'bg-orange-950/60 border-orange-500/40 text-orange-200'
          }`}>
            {pushStatusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : pushStatusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-orange-400 animate-spin shrink-0" />
            )}
            <span className="font-medium">{pushStatusMessage.text}</span>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#232934] bg-[#11141a] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer order-3 sm:order-1 text-center"
          >
            Annuler
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 order-1 sm:order-2">
            <button
              onClick={handleSave}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4 text-zinc-400" />
              <span>Enregistrer en local</span>
            </button>

            <button
              onClick={handlePushToGoogleSheets}
              disabled={isPushingToGsheet}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] via-[#E65100] to-[#FF6D00] hover:brightness-110 active:scale-95 text-white text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-lg shadow-orange-950/60 disabled:opacity-50 cursor-pointer"
            >
              {isPushingToGsheet ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Écriture dans Google Sheets...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Enregistrer & Pousser vers Google Sheets</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
