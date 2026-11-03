import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Award, 
  Calendar, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  Flame,
  Info,
  Scale
} from 'lucide-react';

interface ReglesFftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReglesFftModal: React.FC<ReglesFftModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'qualification' | 'ages' | 'classements' | 'brulage'>('qualification');

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl bg-[#141820] border border-[#2b3342] rounded-3xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-5 border-b border-[#252b37] flex items-center justify-between bg-[#191e28]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#BF360C] to-[#E65100] text-white flex items-center justify-center shadow-lg shadow-orange-950/60 font-black">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg flex items-center gap-2">
                <span>Règles Officielles FFT 2027</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-[#FF6D00] border border-orange-500/40 font-mono font-bold">
                  Compétitions par Équipes
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Guide des qualifications, catégories d'âges, ordre des simples et barème FFT
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Onglets de sélection */}
        <div className="px-5 pt-3 pb-2 border-b border-[#252b37] flex items-center space-x-2 bg-[#11141a] overflow-x-auto">
          <button
            onClick={() => setActiveTab('qualification')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'qualification'
                ? 'bg-[#E65100] text-white shadow-md'
                : 'text-zinc-400 hover:text-white bg-[#191e28]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Licences & Éligibilité</span>
          </button>

          <button
            onClick={() => setActiveTab('ages')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'ages'
                ? 'bg-[#E65100] text-white shadow-md'
                : 'text-zinc-400 hover:text-white bg-[#191e28]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Barème des Âges (2027)</span>
          </button>

          <button
            onClick={() => setActiveTab('classements')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'classements'
                ? 'bg-[#E65100] text-white shadow-md'
                : 'text-zinc-400 hover:text-white bg-[#191e28]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Poids des Classements</span>
          </button>

          <button
            onClick={() => setActiveTab('brulage')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'brulage'
                ? 'bg-[#E65100] text-white shadow-md'
                : 'text-zinc-400 hover:text-white bg-[#191e28]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Brûlage & Gel du Classement</span>
          </button>
        </div>

        {/* Corps de la modale */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-zinc-300 space-y-4">

          {/* ONGLET 1 : LICENCES & ÉLIGIBILITÉ */}
          {activeTab === 'qualification' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#191e28] border border-[#2b3342] space-y-2.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3>1. Statuts de licence autorisés en championnat par équipes</h3>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Conformément aux règlements sportifs de la Fédération Française de Tennis (FFT), seuls les joueurs titulaires des licences suivantes sont qualifiés pour disputer des rencontres officielles :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <strong className="text-emerald-300 font-bold text-xs">Licence C (Club / Multi-raquettes)</strong>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300">
                        VALIDE
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Licence traditionnelle annuelle en club affilié, compétition homologuée autorisée.
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <strong className="text-emerald-300 font-bold text-xs">Licence W (Web Compétition)</strong>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300">
                        VALIDE
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Licence compétition multi-raquettes FFT souscrite en ligne ou rattachée au club.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl mt-2">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Licences non autorisées en championnat</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Les licences <strong>D (Découverte)</strong>, <strong>S (Scolaire)</strong> ou les adhésions non renouvelées auprès de la FFT interdisent formellement l'alignement du joueur sur la feuille de match officielle.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#191e28] border border-[#2b3342] space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Users className="w-4 h-4 text-[#FF6D00]" />
                  <h3>2. Respect strict du Sexe de l'Épreuve</h3>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  L'épreuve par équipes impose la conformité de la civilité officielle FFT :
                </p>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1">
                  <li><strong>Épreuves Messieurs :</strong> uniquement les joueurs de civilité Monsieur.</li>
                  <li><strong>Épreuves Dames :</strong> uniquement les joueuses de civilité Madame.</li>
                  <li><strong>Épreuves Mixtes :</strong> composition paritaire conforme aux règles du règlement de la compétition.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ONGLET 2 : BARÈME DES ÂGES (2027) */}
          {activeTab === 'ages' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#191e28] border border-[#2b3342] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <h3>Barème officiel des catégories d'âges FFT — Millésime 2027</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    Saison 2026/2027
                  </span>
                </div>
                <p className="text-zinc-400 text-xs">
                  L'âge sportif FFT est calculé par rapport à l'année du millésime (2027) : <code>Âge sportif = 2027 - Année de naissance</code>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <strong className="text-white block">11/12 ans</strong>
                      <span className="text-[11px] text-zinc-400">Jeunes</span>
                    </div>
                    <span className="text-orange-400 font-mono font-bold">Nés en 2015 et 2016</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <strong className="text-white block">13/14 ans</strong>
                      <span className="text-[11px] text-zinc-400">Jeunes</span>
                    </div>
                    <span className="text-orange-400 font-mono font-bold">Nés en 2013 et 2014</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <strong className="text-white block">15/16 ans</strong>
                      <span className="text-[11px] text-zinc-400">Cadets</span>
                    </div>
                    <span className="text-orange-400 font-mono font-bold">Nés en 2011 et 2012</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <strong className="text-white block">17/18 ans</strong>
                      <span className="text-[11px] text-zinc-400">Juniors</span>
                    </div>
                    <span className="text-orange-400 font-mono font-bold">Nés en 2009 et 2010</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <strong className="text-white block">Seniors</strong>
                      <span className="text-[11px] text-zinc-400">19 ans et plus</span>
                    </div>
                    <span className="text-emerald-400 font-mono font-bold">Nés en 2008 et avant</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <strong className="text-white block">Seniors +35</strong>
                      <span className="text-[11px] text-zinc-400">Vétérans</span>
                    </div>
                    <span className="text-amber-400 font-mono font-bold">Nés en 1992 et avant</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <strong className="text-white block">Seniors +45</strong>
                      <span className="text-[11px] text-zinc-400">Vétérans</span>
                    </div>
                    <span className="text-amber-400 font-mono font-bold">Nés en 1982 et avant</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <strong className="text-white block">Seniors +55 / +65</strong>
                      <span className="text-[11px] text-zinc-400">Super Vétérans</span>
                    </div>
                    <span className="text-amber-400 font-mono font-bold">Nés en 1972 et avant</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ONGLET 3 : POIDS DES CLASSEMENTS */}
          {activeTab === 'classements' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#191e28] border border-[#2b3342] space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Scale className="w-4 h-4 text-purple-400" />
                  <h3>Règle de l'Ordre Décroissant des Simples</h3>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Dans toute rencontre par équipes, les joueurs de simple doivent obligatoirement être ordonnés du meilleur classement au classement le plus bas :
                </p>
                <div className="p-3 rounded-xl bg-black/30 border border-zinc-800 text-center font-bold text-xs text-orange-300">
                  Simple 1 ≥ Simple 2 ≥ Simple 3 ≥ Simple 4 ≥ Simple 5
                </div>

                <h4 className="font-bold text-white text-xs pt-2">Échelle officielle des poids de classement FFT :</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                    <span className="text-purple-300 font-bold block">1ère Série</span>
                    <span>N1 à N100</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                    <span className="text-rose-300 font-bold block">2ème Série (Négatifs)</span>
                    <span>-30, -15, -4/6, -2/6</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                    <span className="text-rose-300 font-bold block">2ème Série</span>
                    <span>0, 1/6, 2/6, 3/6, 4/6, 5/6, 15</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                    <span className="text-amber-300 font-bold block">3ème Série</span>
                    <span>15/1, 15/2, 15/3, 15/4, 15/5, 30</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 col-span-2">
                    <span className="text-blue-300 font-bold block">4ème Série</span>
                    <span>30/1, 30/2, 30/3, 30/4, 30/5, 40</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 col-span-2">
                    <span className="text-zinc-400 font-bold block">Non Classé</span>
                    <span>NC</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ONGLET 4 : BRÛLAGE & GEL DU CLASSEMENT */}
          {activeTab === 'brulage' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#191e28] border border-[#2b3342] space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <h3>Règle du Brûlage en Équipe Supérieure</h3>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Conformément aux règlements des championnats FFT et des comités départementaux :
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-zinc-300 pl-1 text-xs">
                  <li>Un joueur ayant disputé <strong>2 rencontres en équipe supérieure</strong> (ex : Équipe 1) est automatiquement <strong>brûlé</strong> pour les équipes inférieures (Équipe 2, Équipe 3).</li>
                  <li>Il ne peut plus être aligné en équipe inférieure sous peine de disqualification et de perte de la rencontre par pénalité sportive.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-[#191e28] border border-[#2b3342] space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Info className="w-4 h-4 text-sky-400" />
                  <h3>Règle du Gel du Classement le Jour du Match</h3>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  La FFT publie les nouveaux classements mensuels chaque <strong>premier mardi du mois</strong>.
                </p>
                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs text-sky-200">
                  Le classement pris en compte pour déterminer l'ordre des joueurs sur la feuille de match officielle est obligatoirement <strong>le classement officiel en vigueur le jour précis de la rencontre</strong>. C'est pourquoi l'application stocke ce classement gelé dans les compositions.
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-[#252b37] flex items-center justify-between bg-[#191e28]">
          <span className="text-[11px] text-zinc-400">
            Source : Règlements sportifs officiels de la Fédération Française de Tennis (FFT)
          </span>

          <div className="flex items-center space-x-2">
            <a
              href="https://tenup.fft.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Consulter Ten'Up</span>
            </a>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
