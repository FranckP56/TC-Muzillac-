import React, { useState } from 'react';
import { X, Plus, UserPlus, ShieldCheck } from 'lucide-react';
import { Adherent, Civilite, TypeLicence } from '../types/tennis';

interface NewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (member: Adherent) => void;
}

export const NewMemberModal: React.FC<NewMemberModalProps> = ({
  isOpen,
  onClose,
  onAddMember,
}) => {
  const [nomPrenom, setNomPrenom] = useState('');
  const [civilite, setCivilite] = useState<Civilite>('Monsieur');
  const [dateNaissance, setDateNaissance] = useState('1990');
  const [typeLicence, setTypeLicence] = useState<TypeLicence>('C');
  const [soldeDu, setSoldeDu] = useState('0');
  const [telephonePortable, setTelephonePortable] = useState('');
  const [email, setEmail] = useState('');
  const [dernierClassTennis, setDernierClassTennis] = useState('30');
  const [licence, setLicence] = useState('');
  const [groupeEnseignement, setGroupeEnseignement] = useState('Loisir Adultes');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomPrenom.trim()) return;

    const birthYear = parseInt(dateNaissance.trim().slice(-4), 10) || 1990;
    const ageSportif = `${2027 - birthYear} ans (2027)`;

    const newMember: Adherent = {
      id: 'adh-' + Date.now(),
      nomPrenom: nomPrenom.trim().toUpperCase(),
      civilite,
      dateNaissance: dateNaissance.trim(),
      typeLicence,
      soldeDu: parseFloat(soldeDu) || 0,
      telephonePortable: telephonePortable.trim() || '06 00 00 00 00',
      email: email.trim() || 'contact@tennis-club-muzillac.fr',
      dernierClassTennis: dernierClassTennis.trim().toUpperCase() || 'NC',
      licence: licence.trim() || `${Math.floor(1000000 + Math.random() * 9000000)} A`,
      ageSportif,
      groupeEnseignement: groupeEnseignement.trim() || 'Loisir',
      compteTenUp: 'Actif',
    };

    onAddMember(newMember);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#161a22] border border-[#2b3342] rounded-3xl overflow-hidden shadow-2xl my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#252b37] flex items-center justify-between bg-[#1a1f29]">
          <div className="flex items-center space-x-2.5">
            <UserPlus className="w-5 h-5 text-[#FF6D00]" />
            <h2 className="font-heading font-black text-white text-base">Ajouter un adhérent TCM</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block text-zinc-400 font-semibold mb-1">NOM Prénom *</label>
            <input
              type="text"
              required
              value={nomPrenom}
              onChange={(e) => setNomPrenom(e.target.value)}
              placeholder="Ex: RIO Jean-Yves"
              className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Civilité (Sexe FFT) *</label>
              <select
                value={civilite}
                onChange={(e) => setCivilite(e.target.value as Civilite)}
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              >
                <option value="Monsieur">Monsieur (Hommes - H)</option>
                <option value="Madame">Madame (Dames - F)</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Date Naiss. (JJ/MM/AAAA ou Année) *</label>
              <input
                type="text"
                required
                value={dateNaissance}
                onChange={(e) => setDateNaissance(e.target.value)}
                placeholder="15/04/1988 ou 1988"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Type de Licence (Millésime 2027) *</label>
              <select
                value={typeLicence}
                onChange={(e) => setTypeLicence(e.target.value as TypeLicence)}
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none font-bold"
              >
                <option value="C">C - Club / Compétition (Autorisée)</option>
                <option value="W">W - Web Compétition (Autorisée)</option>
                <option value="D">D - Découverte (Interdite en comp.)</option>
                <option value="S">S - Scolaire (Interdite en comp.)</option>
                <option value="Non renouvelée">Non renouvelée (Interdite)</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Classement FFT</label>
              <select
                value={dernierClassTennis}
                onChange={(e) => setDernierClassTennis(e.target.value)}
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              >
                <option value="5/6">5/6</option>
                <option value="15">15</option>
                <option value="15/1">15/1</option>
                <option value="15/2">15/2</option>
                <option value="15/3">15/3</option>
                <option value="15/4">15/4</option>
                <option value="15/5">15/5</option>
                <option value="30">30</option>
                <option value="30/1">30/1</option>
                <option value="30/2">30/2</option>
                <option value="30/3">30/3</option>
                <option value="30/4">30/4</option>
                <option value="30/5">30/5</option>
                <option value="40">40</option>
                <option value="NC">NC</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Téléphone</label>
              <input
                type="tel"
                value={telephonePortable}
                onChange={(e) => setTelephonePortable(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Solde Dû (€)</label>
              <input
                type="number"
                min="0"
                value={soldeDu}
                onChange={(e) => setSoldeDu(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.fr"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Numéro Licence</label>
              <input
                type="text"
                value={licence}
                onChange={(e) => setLicence(e.target.value)}
                placeholder="1234567 X"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Groupe d'enseignement</label>
            <input
              type="text"
              value={groupeEnseignement}
              onChange={(e) => setGroupeEnseignement(e.target.value)}
              placeholder="Ex: Compétition Hommes 1 / Loisir Adultes"
              className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
            />
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#E65100] hover:bg-[#FF6D00] text-white font-bold transition shadow-lg shadow-orange-950/60 cursor-pointer"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
