import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  FileCode2, 
  FileText, 
  ExternalLink, 
  HelpCircle,
  Shield,
  Download
} from 'lucide-react';

interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({ isOpen, onClose }) => {
  const [activeFile, setActiveFile] = useState<'codegs' | 'guide' | 'bareme'>('codegs');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const CODE_GS_CONTENT = `/**
 * =========================================================================
 * MUZILLAC TENNIS CLUB (TCM) - GOOGLE APPS SCRIPT BACKEND
 * Fichier : Code.gs (Millésime FFT 2027)
 * =========================================================================
 */

const SHEET_ADHERENTS = 'Adhérents';
const SHEET_RENCONTRES = 'Rencontres';

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    const action = e.parameter.action;
    let result = {};

    try {
      if (action === 'getAdherents' || action === 'adherents') {
        result = { success: true, data: getAdherents() };
      } else if (action === 'getRencontres' || action === 'rencontres') {
        result = { success: true, data: getRencontres() };
      } else if (action === 'getAll' || action === 'all') {
        result = { 
          success: true, 
          adherents: getAdherents(),
          rencontres: getRencontres(),
          clubInfo: {
            nom: "Tennis Club de Muzillac (TCM)",
            adresse: "Complexe sportif du Chêne Rond, 56190 Muzillac",
            email: "tennisclubmuzillac@gmail.com"
          }
        };
      } else {
        result = { success: false, error: "Action inconnue : " + action };
      }
    } catch (err) {
      result = { success: false, error: err.toString() };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.initialData = {
    adherents: getAdherents(),
    rencontres: getRencontres()
  };

  return template.evaluate()
    .setTitle("Muzillac Tennis Club (TCM)")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAdherents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ADHERENTS);
  if (!sheet) throw new Error("Onglet '" + SHEET_ADHERENTS + "' introuvable");

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h || '').trim().toLowerCase());
  const idxNom = getColIndex(headers, ['nom prénom', 'nom', 'adhérent'], 0);
  const idxCivilite = getColIndex(headers, ['civilité', 'civilite', 'sexe'], -1);
  const idxDateNaiss = getColIndex(headers, ['date naiss.', 'date naiss', 'naissance'], -1);
  const idxTypeLicence = getColIndex(headers, ['type licence', 'statut licence'], -1);
  const idxSolde = getColIndex(headers, ['solde dû', 'solde du', 'solde'], 1);
  const idxTel = getColIndex(headers, ['téléphone portable', 'portable'], 2);
  const idxEmail = getColIndex(headers, ['email', 'mail'], 3);
  const idxClass = getColIndex(headers, ['dernier class. tennis', 'classement'], 4);
  const idxLicence = getColIndex(headers, ['licence', 'n° licence'], 5);
  const idxAgeSportif = getColIndex(headers, ['age sportif', 'catégorie'], 6);
  const idxGroupe = getColIndex(headers, ['groupe enseignement', 'groupe'], 7);
  const idxTenUp = getColIndex(headers, ['compte ten\'up', 'tenup'], 8);

  const adherents = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const nomPrenom = String(row[idxNom] || '').trim();
    if (!nomPrenom) continue;

    let solde = 0;
    const rawSolde = idxSolde >= 0 ? row[idxSolde] : 0;
    if (typeof rawSolde === 'number') {
      solde = rawSolde;
    } else if (rawSolde) {
      const clean = String(rawSolde).replace('€', '').replace(',', '.').trim();
      solde = parseFloat(clean) || 0;
    }

    let tel = idxTel >= 0 ? String(row[idxTel] || '').trim() : '';
    if (tel && !tel.startsWith('+') && !tel.startsWith('0') && tel.length === 9) {
      tel = '0' + tel;
    }

    let civilite = 'Monsieur';
    if (idxCivilite >= 0 && row[idxCivilite]) {
      const c = String(row[idxCivilite]).toLowerCase();
      if (c.includes('mme') || c.includes('madame') || c.includes('f')) civilite = 'Madame';
    }

    let dateNaissStr = '1990';
    if (idxDateNaiss >= 0 && row[idxDateNaiss]) {
      const dRaw = row[idxDateNaiss];
      if (dRaw instanceof Date) {
        const d = ("0" + dRaw.getDate()).slice(-2);
        const m = ("0" + (dRaw.getMonth() + 1)).slice(-2);
        dateNaissStr = d + "/" + m + "/" + dRaw.getFullYear();
      } else {
        dateNaissStr = String(dRaw).trim();
      }
    }

    let typeLicence = 'C';
    if (idxTypeLicence >= 0 && row[idxTypeLicence]) {
      typeLicence = String(row[idxTypeLicence]).trim().toUpperCase();
    }

    adherents.push({
      id: 'adh-' + i,
      nomPrenom: nomPrenom,
      civilite: civilite,
      dateNaissance: dateNaissStr,
      typeLicence: typeLicence,
      soldeDu: solde,
      telephonePortable: tel,
      email: idxEmail >= 0 ? String(row[idxEmail] || '').trim() : '',
      dernierClassTennis: idxClass >= 0 ? String(row[idxClass] || 'NC').trim().toUpperCase() : 'NC',
      licence: idxLicence >= 0 ? String(row[idxLicence] || '').trim() : '',
      ageSportif: idxAgeSportif >= 0 ? String(row[idxAgeSportif] || '').trim() : 'Senior',
      groupeEnseignement: idxGroupe >= 0 ? String(row[idxGroupe] || 'Loisir').trim() : 'Loisir',
      compteTenUp: idxTenUp >= 0 ? String(row[idxTenUp] || 'Actif').trim() : 'Actif'
    });
  }

  return sortAdherentsByRanking(adherents);
}

function getRencontres() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RENCONTRES);
  if (!sheet) throw new Error("Onglet '" + SHEET_RENCONTRES + "' introuvable");

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h || '').trim().toLowerCase());
  const idxDate = getColIndex(headers, ['date de la rencontre', 'date'], 0);
  const idxLibelle = getColIndex(headers, ['libellé de l\'homologation', 'libellé'], 1);
  const idxCatAge = getColIndex(headers, ['catégorie d\'âge de l\'homologation', 'catégorie'], 2);
  const idxSexe = getColIndex(headers, ['sexe de l\'homologation', 'sexe'], -1);
  const idxEquipe = getColIndex(headers, ['numéro de l\'équipe', 'équipe'], 3);
  const idxAccueil = getColIndex(headers, ['club d\'accueil nom', 'accueil'], 4);
  const idxVisiteur = getColIndex(headers, ['club visiteur nom', 'visiteur'], 5);
  const idxScore = getColIndex(headers, ['score'], 6);
  const idxCapitaine = getColIndex(headers, ['nom capitaine', 'capitaine'], 7);
  const idxTelCap = getColIndex(headers, ['portable capitaine', 'tel capitaine'], 8);
  const idxMailCap = getColIndex(headers, ['mail capitaine'], 9);

  const rencontres = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const clubAccueil = idxAccueil >= 0 ? String(row[idxAccueil] || '').trim() : '';
    const clubVisiteur = idxVisiteur >= 0 ? String(row[idxVisiteur] || '').trim() : '';
    if (!clubAccueil && !clubVisiteur) continue;

    let dateStr = '';
    const dateRaw = idxDate >= 0 ? row[idxDate] : '';
    if (dateRaw instanceof Date) {
      const d = ("0" + dateRaw.getDate()).slice(-2);
      const m = ("0" + (dateRaw.getMonth() + 1)).slice(-2);
      dateStr = d + "/" + m + "/" + dateRaw.getFullYear();
    } else {
      dateStr = String(dateRaw || '').trim();
    }

    let telCapitaine = idxTelCap >= 0 ? String(row[idxTelCap] || '').trim() : '';
    if (telCapitaine && !telCapitaine.startsWith('+') && !telCapitaine.startsWith('0') && telCapitaine.length === 9) {
      telCapitaine = '0' + telCapitaine;
    }

    let sexe = 'Messieurs';
    if (idxSexe >= 0 && row[idxSexe]) {
      const s = String(row[idxSexe]).toLowerCase();
      if (s.includes('dame') || s.includes('f')) sexe = 'Dames';
      else if (s.includes('mixte')) sexe = 'Mixte';
    } else {
      const combined = (row[idxLibelle] + ' ' + row[idxCatAge]).toLowerCase();
      if (combined.includes('dame') || combined.includes('femm')) sexe = 'Dames';
    }

    rencontres.push({
      id: 'rencontre-' + i,
      dateRencontre: dateStr,
      libelleHomologation: idxLibelle >= 0 ? String(row[idxLibelle] || '').trim() : '',
      categorieAgeHomologation: idxCatAge >= 0 ? String(row[idxCatAge] || '').trim() : 'Seniors',
      sexeHomologation: sexe,
      numeroEquipe: idxEquipe >= 0 ? String(row[idxEquipe] || '').trim() : 'Équipe 1',
      clubAccueilNom: clubAccueil,
      clubVisiteurNom: clubVisiteur,
      score: idxScore >= 0 ? String(row[idxScore] || '').trim() : 'À venir',
      nomCapitaine: idxCapitaine >= 0 ? String(row[idxCapitaine] || '').trim() : '',
      portableCapitaine: telCapitaine,
      mailCapitaine: idxMailCap >= 0 ? String(row[idxMailCap] || '').trim() : ''
    });
  }

  return rencontres;
}

function getColIndex(headers, matchKeywords, defaultIndex) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (let k = 0; k < matchKeywords.length; k++) {
      if (h.includes(matchKeywords[k])) return i;
    }
  }
  return defaultIndex;
}

function getRankingWeight(rank) {
  if (!rank) return 0;
  const clean = rank.trim().toUpperCase().replace(/\\s+/g, '');
  if (clean.startsWith('N') && clean !== 'NC') {
    const num = parseInt(clean.replace('N', ''), 10) || 100;
    return 1000 - num;
  }
  const weights = {
    '-30': 450, '-15': 430, '-4/6': 410, '-2/6': 390, '0': 370,
    '1/6': 350, '2/6': 330, '3/6': 310, '4/6': 290, '5/6': 270, '15': 250,
    '15/1': 230, '15/2': 210, '15/3': 190, '15/4': 170, '15/5': 150, '30': 130,
    '30/1': 110, '30/2': 90, '30/3': 70, '30/4': 50, '30/5': 30, '40': 15, 'NC': 0
  };
  return weights[clean] !== undefined ? weights[clean] : 0;
}

function sortAdherentsByRanking(list) {
  return list.sort(function(a, b) {
    const weightA = getRankingWeight(a.dernierClassTennis);
    const weightB = getRankingWeight(b.dernierClassTennis);
    if (weightB !== weightA) return weightB - weightA;
    return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
  });
}`;

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <div className="w-10 h-10 rounded-xl bg-[#E65100] text-white flex items-center justify-center shadow-lg shadow-orange-950/60 font-black">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg">
                Fichiers Google Apps Script & Règles FFT 2027
              </h2>
              <p className="text-xs text-zinc-400">
                Code backend Google Sheets avec module d'éligibilité pour les capitaines
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
        <div className="px-5 pt-3 pb-2 border-b border-[#252b37] flex items-center justify-between bg-[#11141a]">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveFile('codegs')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFile === 'codegs'
                  ? 'bg-[#E65100] text-white'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Code.gs</span>
            </button>

            <button
              onClick={() => setActiveFile('bareme')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFile === 'bareme'
                  ? 'bg-[#E65100] text-white'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Barème FFT 2027</span>
            </button>

            <button
              onClick={() => setActiveFile('guide')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFile === 'guide'
                  ? 'bg-[#E65100] text-white'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Guide Déploiement</span>
            </button>
          </div>

          {activeFile === 'codegs' && (
            <button
              onClick={() => handleCopy(CODE_GS_CONTENT)}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-[#FF6D00] border border-orange-500/40 text-xs font-bold transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier le code'}</span>
            </button>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {activeFile === 'codegs' && (
            <pre className="font-mono text-[11px] text-zinc-300 bg-[#0c0e12] p-4 rounded-2xl border border-zinc-800/80 overflow-x-auto leading-relaxed">
              <code>{CODE_GS_CONTENT}</code>
            </pre>
          )}

          {activeFile === 'bareme' && (
            <div className="space-y-4 text-zinc-300">
              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">1. Règle Licence Officielle FFT</h3>
                <p className="text-xs text-zinc-400">
                  Seuls les statuts de licence <strong>C</strong> (Club / Compétition) et <strong>W</strong> (Web Compétition multi-raquettes) permettent d'aligner un joueur en rencontre officielle interclubs. Les licences D (Découverte), S (Scolaire) ou non renouvelées bloquent la sélection.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">2. Règle Sexe / Civilité</h3>
                <p className="text-xs text-zinc-400">
                  Correspondance stricte entre 'Civilité' (Monsieur = H, Madame = F) et 'Sexe de l'homologation' de la rencontre. Une joueuse Madame ne peut être alignée sur une feuille de match Messieurs et inversement (sauf épreuve Mixte).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">3. Barème des Âges - Millésime FFT 2027</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">11/12 ans :</strong> nés en 2015 et 2016
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">13/14 ans :</strong> nés en 2013 et 2014
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">15/16 ans :</strong> nés en 2011 et 2012
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">17/18 ans :</strong> nés en 2009 et 2010
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">Seniors :</strong> nés en 2008 et avant
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">Seniors +35 :</strong> nés entre 1988 et 1992 (et avant)
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">Seniors +45 :</strong> nés entre 1978 et 1982 (et avant)
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">Seniors +55 :</strong> nés en 1972 et avant
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFile === 'guide' && (
            <div className="space-y-4 text-zinc-300">
              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">Étape 1 : Préparer le Google Sheets</h3>
                <p className="text-xs text-zinc-400">
                  Dans votre classeur, assurez-vous d'avoir les 2 onglets :
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong className="text-white">Adhérents</strong> : avec colonnes <code>NOM Prénom, Civilité, Date Naiss., Type Licence, Solde dû, Téléphone Portable, Email, Dernier class. tennis, Licence, Age sportif, Groupe enseignement, Compte Ten'UP</code></li>
                  <li><strong className="text-white">Rencontres</strong> : avec colonnes <code>Date de la rencontre, Libellé de l'homologation, Catégorie d'âge de l'homologation, Sexe de l'homologation, Numéro de l'équipe, Club d'accueil nom, Club visiteur nom, Score, Nom capitaine, Portable capitaine, Mail capitaine</code></li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">Étape 2 : Coller le code</h3>
                <p className="text-xs text-zinc-400">
                  1. Cliquez sur <strong className="text-white">Extensions &gt; Apps Script</strong>.<br/>
                  2. Remplacez le contenu de <code>Code.gs</code> par le code ci-dessus.<br/>
                  3. Cliquez sur Enregistrer (icône disquette).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">Étape 3 : Déployer la Web App</h3>
                <p className="text-xs text-zinc-400">
                  1. Cliquez sur <strong className="text-white">Déployer &gt; Nouveau déploiement &gt; Application Web</strong>.<br/>
                  2. Exécuter en tant que : <strong>Moi</strong>.<br/>
                  3. Qui a accès : <strong>Tout le monde</strong>.<br/>
                  4. Collez l'URL obtenue dans l'onglet <em>Infos Club</em> de l'application !
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#252b37] bg-[#11141a] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Fichier physique sauvegardé sous <code>/Code.gs</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
