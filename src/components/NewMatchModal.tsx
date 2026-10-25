import React, { useState } from 'react';
import { X, Trophy } from 'lucide-react';
import { Rencontre, SexeHomologation } from '../types/tennis';

interface NewMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMatch: (match: Rencontre) => void;
}

export const NewMatchModal: React.FC<NewMatchModalProps> = ({
  isOpen,
  onClose,
  onAddMatch,
}) => {
  const [dateRencontre, setDateRencontre] = useState('15/12/2026');
  const [libelleHomologation, setLibelleHomologation] = useState('Championnat Départemental 1ère Div');
  const [categorieAgeHomologation, setCategorieAgeHomologation] = useState('Seniors');
  const [sexeHomologation, setSexeHomologation] = useState<SexeHomologation>('Messieurs');
  const [numeroEquipe, setNumeroEquipe] = useState('Équipe 1');
  const [clubAccueilNom, setClubAccueilNom] = useState('TC Muzillac 1');
  const [clubVisiteurNom, setClubVisiteurNom] = useState('');
  const [score, setScore] = useState('À venir');
  const [nomCapitaine, setNomCapitaine] = useState('LE GUENNEC Laurent');
  const [portableCapitaine, setPortableCapitaine] = useState('06 12 34 56 78');
  const [mailCapitaine, setMailCapitaine] = useState('l.leguennec@orange.fr');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubVisiteurNom.trim()) return;

    const newMatch: Rencontre = {
      id: 'rec-' + Date.now(),
      dateRencontre: dateRencontre.trim(),
      libelleHomologation: libelleHomologation.trim(),
      categorieAgeHomologation: categorieAgeHomologation.trim(),
      sexeHomologation,
      numeroEquipe: numeroEquipe.trim(),
      clubAccueilNom: clubAccueilNom.trim(),
      clubVisiteurNom: clubVisiteurNom.trim(),
      score: score.trim() || 'À venir',
      nomCapitaine: nomCapitaine.trim(),
      portableCapitaine: portableCapitaine.trim(),
      mailCapitaine: mailCapitaine.trim(),
    };

    onAddMatch(newMatch);
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
            <Trophy className="w-5 h-5 text-[#FF6D00]" />
            <h2 className="font-heading font-black text-white text-base">Ajouter une rencontre interclubs</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Date</label>
              <input
                type="text"
                required
                value={dateRencontre}
                onChange={(e) => setDateRencontre(e.target.value)}
                placeholder="JJ/MM/AAAA"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Numéro d'équipe</label>
              <input
                type="text"
                value={numeroEquipe}
                onChange={(e) => setNumeroEquipe(e.target.value)}
                placeholder="Équipe 1 / Équipe 2 / +35"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Sexe de l'homologation *</label>
              <select
                value={sexeHomologation}
                onChange={(e) => setSexeHomologation(e.target.value as SexeHomologation)}
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none font-bold"
              >
                <option value="Messieurs">Messieurs (Hommes)</option>
                <option value="Dames">Dames (Femmes)</option>
                <option value="Mixte">Mixte</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Catégorie d'âge FFT 2027 *</label>
              <select
                value={categorieAgeHomologation}
                onChange={(e) => setCategorieAgeHomologation(e.target.value)}
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none font-bold"
              >
                <option value="Seniors">Seniors (nés en 2008 et avant)</option>
                <option value="Seniors +35">Seniors +35 (nés en 1992 et avant)</option>
                <option value="Seniors +45">Seniors +45 (nés en 1982 et avant)</option>
                <option value="Seniors +55">Seniors +55 (nés en 1972 et avant)</option>
                <option value="17/18 ans">17/18 ans (nés en 2009-2010)</option>
                <option value="15/16 ans">15/16 ans (nés en 2011-2012)</option>
                <option value="13/14 ans">13/14 ans (nés en 2013-2014)</option>
                <option value="11/12 ans">11/12 ans (nés en 2015-2016)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Libellé Homologation</label>
            <input
              type="text"
              value={libelleHomologation}
              onChange={(e) => setLibelleHomologation(e.target.value)}
              placeholder="Championnat Départemental 1ère Div"
              className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Club d'accueil (Dom.)</label>
              <input
                type="text"
                required
                value={clubAccueilNom}
                onChange={(e) => setClubAccueilNom(e.target.value)}
                placeholder="TC Muzillac 1"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Club visiteur (Ext.) *</label>
              <input
                type="text"
                required
                value={clubVisiteurNom}
                onChange={(e) => setClubVisiteurNom(e.target.value)}
                placeholder="Ex: TC Sarzeau 2"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Score</label>
            <input
              type="text"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="À venir ou 4/1"
              className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Nom Capitaine</label>
            <input
              type="text"
              value={nomCapitaine}
              onChange={(e) => setNomCapitaine(e.target.value)}
              placeholder="LE GUENNEC Laurent"
              className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Portable Capitaine</label>
              <input
                type="tel"
                value={portableCapitaine}
                onChange={(e) => setPortableCapitaine(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Mail Capitaine</label>
              <input
                type="email"
                value={mailCapitaine}
                onChange={(e) => setMailCapitaine(e.target.value)}
                placeholder="capitaine@tcm.fr"
                className="w-full px-3 py-2 bg-[#101319] text-white rounded-xl border border-[#272e3b] focus:border-[#E65100] outline-none"
              />
            </div>
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
