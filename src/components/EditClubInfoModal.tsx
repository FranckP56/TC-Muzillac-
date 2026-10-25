import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { ClubInfo, Enseignant, ClubTarif } from '../types/tennis';

interface EditClubInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubInfo: ClubInfo;
  onSave: (updatedInfo: ClubInfo) => void;
}

export const EditClubInfoModal: React.FC<EditClubInfoModalProps> = ({
  isOpen,
  onClose,
  clubInfo,
  onSave,
}) => {
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
    tarifs: clubInfo.tarifs && clubInfo.tarifs.length > 0
      ? [...clubInfo.tarifs]
      : [
          { id: 't1', label: 'Cotisation Jeune Galaxie (1h/semaine)', montant: 135, categorie: 'jeune', description: 'Licence FFT comprise' },
          { id: 't2', label: 'École de Tennis Jeunes (1h30/semaine)', montant: 185, categorie: 'jeune', description: 'Licence FFT + entraînements' },
          { id: 't3', label: 'Pôle Compétition Jeunes (2 x 1h30)', montant: 260, categorie: 'competition', description: 'Préparation championnats' },
          { id: 't4', label: 'Cours Collectifs Adultes (1h30/semaine)', montant: 215, categorie: 'adulte', description: 'Licence FFT incluse' },
          { id: 't5', label: 'Adhésion seule / Accès courts libre', montant: 110, categorie: 'adhesion', description: 'Accès 7j/7 + badge' },
        ],
    horairesPermanence: clubInfo.horairesPermanence || 'Mercredi 14h-18h et Samedi 10h-12h au Club-house',
  }));

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'bureau' | 'enseignants' | 'installations' | 'tarifs'>('enseignants');
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
  const [newTarifCat, setNewTarifCat] = useState<'jeune' | 'adulte' | 'competition' | 'adhesion'>('jeune');

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

  const handleAddTarif = () => {
    if (!newTarifLabel.trim()) return;
    const newT: ClubTarif = {
      id: `tarif-${Date.now()}`,
      label: newTarifLabel.trim(),
      montant: Number(newTarifMontant) || 0,
      categorie: newTarifCat,
    };
    setFormData(prev => ({
      ...prev,
      tarifs: [...(prev.tarifs || []), newT],
    }));
    setNewTarifLabel('');
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Président *</label>
                  <input
                    type="text"
                    value={formData.president}
                    onChange={(e) => setFormData({ ...formData, president: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Secrétaire *</label>
                  <input
                    type="text"
                    value={formData.secretaire}
                    onChange={(e) => setFormData({ ...formData, secretaire: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Trésorier *</label>
                  <input
                    type="text"
                    value={formData.tresorier}
                    onChange={(e) => setFormData({ ...formData, tresorier: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                  />
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
              <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                Grille des Tarifs & Cotisations ({formData.tarifs?.length || 0})
              </h3>

              <div className="space-y-2">
                {(formData.tarifs || []).map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-[#171b23] rounded-xl border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{t.label}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-zinc-800 text-zinc-300">
                          {t.categorie}
                        </span>
                      </div>
                      {t.description && <p className="text-[11px] text-zinc-400">{t.description}</p>}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-heading font-black text-white text-sm">
                        {t.montant} €
                      </span>
                      <button
                        onClick={() => handleRemoveTarif(t.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newTarifLabel}
                    onChange={(e) => setNewTarifLabel(e.target.value)}
                    placeholder="Formule (ex: Adhésion seule Étudiant)"
                    className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={newTarifMontant}
                    onChange={(e) => setNewTarifMontant(Number(e.target.value))}
                    placeholder="Montant en €"
                    className="w-full px-3 py-2 rounded-xl bg-[#171b23] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] outline-none"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleAddTarif}
                    className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter</span>
                  </button>
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

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#232934] bg-[#11141a] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
          >
            Annuler
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 active:scale-95 text-white text-xs sm:text-sm font-black transition flex items-center gap-2 shadow-lg shadow-orange-950/60 cursor-pointer"
          >
            {successSaved ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Enregistré avec succès !</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Enregistrer les informations</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
