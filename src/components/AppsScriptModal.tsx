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
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAll';
  var result = {};

  try {
    if (action === 'getAll' || action === 'all') {
      result = {
        success: true,
        adherents: getSheetRawValues('Adhérents'),
        rencontres: getSheetRawValues('Rencontres'),
        compositions: getSheetRawValues('Compositions_Equipes'),
        bureau: getSheetRawValues('Bureau_Profs'),
        installations: getSheetRawValues('Installations'),
        tarifs: getSheetRawValues('Cotisations_Tarifs')
      };
    } else if (action === 'getAdherents' || action === 'adherents') {
      result = { success: true, data: getSheetRawValues('Adhérents') };
    } else if (action === 'getRencontres' || action === 'rencontres') {
      result = { success: true, data: getSheetRawValues('Rencontres') };
    } else {
      result = { success: false, error: "Action inconnue : " + action };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    var json = raw ? JSON.parse(raw) : {};
    var action = json.action || (e && e.parameter ? e.parameter.action : '');

    if (action === 'saveComposition') {
      return handleSaveComposition(json);
    } else if (action === 'saveClubInfo') {
      return handleSaveClubInfo(json);
    } else {
      return createJsonResponse({ success: false, error: 'Action inconnue : ' + action });
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetRawValues(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getValues();
}

function handleSaveComposition(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Compositions_Equipes');
  if (!sheet) {
    sheet = ss.insertSheet('Compositions_Equipes');
    sheet.appendRow([
      "ID Rencontre", "Date Rencontre", "Numéro Équipe", "Homologation", "Catégorie", "Sexe",
      "Club Accueil", "Club Visiteur", "Poste", "Nom Prénom Joueur", "N° Licence", "Classement Gelé au Match",
      "Date Naissance", "Âge Sportif", "Type Licence", "Heure Début", "Lieu Rencontre", "Nombre Courts",
      "Date Enregistrement", "Validé par Capitaine"
    ]);
  }

  var matchId = payload.rencontreId;
  var rows = sheet.getDataRange().getValues();
  var keepRows = [];
  if (rows.length > 0) {
    keepRows.push(rows[0]);
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() !== String(matchId || '').trim()) {
        keepRows.push(rows[i]);
      }
    }
  }

  var slots = payload.slots || [];
  var nowStr = payload.dateValidation || new Date().toISOString();
  for (var j = 0; j < slots.length; j++) {
    var s = slots[j];
    keepRows.push([
      matchId,
      payload.dateRencontre || '',
      payload.numeroEquipe || '',
      payload.libelleHomologation || '',
      payload.categorieAgeHomologation || '',
      payload.sexeHomologation || '',
      payload.clubAccueilNom || '',
      payload.clubVisiteurNom || '',
      s.poste || '',
      s.nomPrenom || '',
      s.licence || '',
      s.classementGele || 'NC',
      s.dateNaissance || '',
      s.ageSportif || '',
      s.typeLicence || '',
      payload.heureDebut || '09:00',
      payload.lieuRencontre || 'Clos des Moines (Muzillac)',
      payload.nombreCourts || 2,
      nowStr,
      payload.valideParCapitaine ? 'OUI' : 'NON'
    ]);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, keepRows.length, keepRows[0].length).setValues(keepRows);
  return createJsonResponse({ success: true, rowsSaved: slots.length });
}

function handleSaveClubInfo(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var info = payload.clubInfo || {};

  // Mise à jour de Bureau_Profs
  var bSheet = ss.getSheetByName('Bureau_Profs');
  if (bSheet && (info.president || info.secretaire || info.tresorier)) {
    var bRows = [
      ["Rôle / Fonction", "Nom Prénom", "Diplôme / Titre", "Téléphone", "Email", "Description / Missions"],
      ["Président", info.president || "", "Dirigeant", info.presidentTelephone || "", info.presidentEmail || "", "Direction du club"],
      ["Secrétaire", info.secretaire || "", "Dirigeante", info.secretaireTelephone || "", info.secretaireEmail || "", "Secrétariat et licences"],
      ["Trésorier", info.tresorier || "", "Dirigeant", info.tresorierTelephone || "", info.tresorierEmail || "", "Comptabilité et finances"]
    ];
    var profs = info.enseignants || [];
    for (var p = 0; p < profs.length; p++) {
      bRows.push(["Enseignant", profs[p].nomPrenom, profs[p].diplome, profs[p].telephone || "", profs[p].email || "", profs[p].description || ""]);
    }
    bSheet.clearContents();
    bSheet.getRange(1, 1, bRows.length, bRows[0].length).setValues(bRows);
  }

  return createJsonResponse({ success: true });
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
