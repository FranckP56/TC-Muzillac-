import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  Settings2, 
  Upload, 
  Building, 
  Save, 
  FileText,
  CreditCard,
  Download,
  Loader2,
  Mail,
  MessageSquare,
  Share2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Adherent, ClubInfo } from '../types/tennis';
import { extractBirthYear } from '../utils/fftEligibility';

interface AttestationModalProps {
  adherent: Adherent;
  clubInfo: ClubInfo;
  onClose: () => void;
  onSaveClubInfo?: (info: ClubInfo) => Promise<void> | void;
}

export const AttestationModal: React.FC<AttestationModalProps> = ({
  adherent,
  clubInfo,
  onClose,
  onSaveClubInfo,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditingClubInfo, setIsEditingClubInfo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  // Formulaire Club_Info (stocké dans l'onglet Club_Info de Données_appli)
  const [editClub, setEditClub] = useState<ClubInfo>({
    ...clubInfo,
    nom: clubInfo.nom || 'Tennis Club de Muzillac',
    codeClub: clubInfo.codeClub || '52 56 0212',
    adresse: clubInfo.adresse || 'Complexe du Clos des Moines, Rue du Stade',
    codePostal: clubInfo.codePostal || '56190',
    ville: clubInfo.ville || 'Muzillac',
    telephone: clubInfo.telephone || '02 97 41 67 80',
    email: clubInfo.email || 'tennisclubmuzillac@gmail.com',
    rna: clubInfo.rna || 'W563001859',
    siret: clubInfo.siret || '439 123 456 00012',
    signataireNom: clubInfo.signataireNom || clubInfo.president || 'Gilles LE BOURNOT',
    signataireFonction: clubInfo.signataireFonction || 'Président',
  });

  const birthYear = extractBirthYear(adherent.dateNaissance);
  const isMinor = birthYear ? 2027 - birthYear < 18 : false;

  // Choix de la formule :
  // 'cours' = Le prix des cours comprend l'adhésion au club / accès aux courts (soit l'un soit l'autre)
  // 'adh_seule' = Cotisation club seule / Pratique libre
  const [formulaType, setFormulaType] = useState<'cours' | 'adh_seule'>(() => {
    const groupe = (adherent.groupeEnseignement || '').toLowerCase();
    return (groupe !== '' && !groupe.includes('libre') && !groupe.includes('sans cours')) ? 'cours' : 'adh_seule';
  });

  // Montant des cours collectifs (qui inclut déjà la cotisation club et la licence)
  const [coursAmount, setCoursAmount] = useState<string>(() => {
    const rawGroupe = (adherent.groupeEnseignement || '').toLowerCase();
    if (rawGroupe.includes('mini')) return '140';
    if (rawGroupe.includes('jeune') || rawGroupe.includes('ado')) return '200';
    if (rawGroupe.includes('compet') || rawGroupe.includes('compétition')) return '250';
    if (rawGroupe.includes('adulte') || rawGroupe.includes('homme') || rawGroupe.includes('femme')) return '330';
    return isMinor ? '200' : '330';
  });

  // Montant de l'adhésion seule (pratique libre, qui inclut la licence)
  const [cotisationAmount, setCotisationAmount] = useState<string>(() => {
    return isMinor ? '60' : '90';
  });

  // Montant de la licence FFT obligatoire (récupéré depuis clubInfo.tarifs si disponible)
  const [licenceFft, setLicenceFft] = useState<string>(() => {
    if (clubInfo?.tarifs && clubInfo.tarifs.length > 0) {
      const matchLic = clubInfo.tarifs.find(t => {
        const lbl = t.label.toLowerCase();
        if (isMinor) {
          return lbl.includes('licence') && (lbl.includes('jeune') || lbl.includes('enfant'));
        } else {
          return lbl.includes('licence') && (lbl.includes('adulte') || lbl.includes('senior'));
        }
      });
      if (matchLic) return String(matchLic.montant);
    }
    return isMinor ? '23' : '33';
  });

  // Modalités de règlement (rendues facultatives par un interrupteur)
  const [showModalitesPaiement, setShowModalitesPaiement] = useState<boolean>(false);
  const [datePaiement, setDatePaiement] = useState<string>(() => {
    return new Date().toLocaleDateString('fr-FR');
  });
  const [modeReglement, setModeReglement] = useState<string>('Virement bancaire');
  const [customModeReglement, setCustomModeReglement] = useState<string>('');

  // Adhérent / Adresse et Représentant légal
  const defaultAdresseAdherent = [
    adherent.adresse,
    adherent.codePostal || '56190',
    adherent.ville || 'Muzillac'
  ].filter(Boolean).join(', ');

  const [adresseAdherent, setAdresseAdherent] = useState<string>(defaultAdresseAdherent || 'Muzillac (56190)');
  const [representantLegal, setRepresentantLegal] = useState<string>(adherent.representantLegal || '');

  // Calcul du total perçu et séparation du coût de la licence :
  // Le tarif saisi (nMain) est le tarif global incluant la licence FFT.
  // La licence (nLicence) en est retranchée pour afficher la part club exacte + la licence = total perçu.
  const nMain = formulaType === 'cours' ? (parseFloat(coursAmount) || 0) : (parseFloat(cotisationAmount) || 0);
  const nLicence = parseFloat(licenceFft) || 0;
  const partClub = Math.max(0, nMain - nLicence);
  const totalPercu = nMain.toFixed(0);

  const dateJourStr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Partage par Email
  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Attestation de paiement de cotisation - ${adherent.nomPrenom} - Tennis Club de Muzillac`);
    const body = encodeURIComponent(fullText);
    const mailTo = adherent.email || '';
    window.open(`mailto:${mailTo}?subject=${subject}&body=${body}`, '_blank');
  };

  // Partage par WhatsApp
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(fullText);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Gestion du téléversement d'image en Base64 (Logo, Signature, Tampon)
  const handleFileUpload = (field: 'logoUrl' | 'signatureUrl' | 'tamponUrl', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setEditClub((prev: ClubInfo) => ({ ...prev, [field]: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // Sauvegarde des modifications dans Club_Info (GSheet Données_appli)
  const handleSaveClubInfo = async () => {
    setIsSaving(true);
    try {
      if (onSaveClubInfo) {
        await onSaveClubInfo(editClub);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditingClubInfo(false);
      }, 1500);
    } catch (e) {
      console.warn("Erreur sauvegarde ClubInfo:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Génération directe d'un fichier PDF A4 imprimable à télécharger
  const handleGeneratePdf = async () => {
    const element = document.getElementById('attestation-printable-card');
    if (!element) return;

    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const safeName = (adherent.nomPrenom || 'Adherent').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Attestation_Paiement_TCM_${safeName}.pdf`;
      pdf.save(fileName);

      setPdfSuccessMessage(`✓ Document "${fileName}" enregistré dans le dossier "Téléchargements" (Downloads) de votre ordinateur !`);
    } catch (err) {
      console.warn("Erreur génération PDF, bascule sur impression navigateur :", err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Texte intégral conforme au modèle pour copie dans le presse-papier et envoi email/WhatsApp
  const effectiveModeStr = modeReglement === 'autre' ? (customModeReglement || 'Autre mode') : modeReglement;
  const fullText = `[Logo du club]
${editClub.nom || 'Tennis Club de Muzillac'}
Association loi 1901 à but non lucratif
Siège social : ${editClub.adresse || 'Complexe du Clos des Moines, Rue du Stade'}
Code postal et Ville : ${editClub.codePostal || '56190'} ${editClub.ville || 'Muzillac'}
Numéro RNA (Répertoire National des Associations) : ${editClub.rna || 'W563001859'}
Numéro SIRET : ${editClub.siret || '439 123 456 00012'}
Numéro d'affiliation FFT : ${editClub.codeClub || '52 56 0212'}
Contact : ${editClub.telephone || '02 97 41 67 80'} | ${editClub.email || 'tennisclubmuzillac@gmail.com'}

ATTESTATION DE PAIEMENT DE COTISATION SPORTIVE
Saison sportive 2026 / 2027

Je soussigné, ${editClub.signataireNom || editClub.president || 'Raphaël EVAIN'}, agissant en qualité de ${editClub.signataireFonction || 'Président'} de l’association ${editClub.nom || 'Tennis Club de Muzillac'}, dûment habilité à délivrer la présente attestation, certifie que :

Mme / M. : ${adherent.nomPrenom}
Né(e) le : ${adherent.dateNaissance || 'Non renseignée'}
Demeurant au : ${adresseAdherent}
${(isMinor || representantLegal) ? `(Si l'attestation concerne un enfant mineur :)\nReprésentant légal : ${representantLegal || 'Non renseigné'}\n` : ''}
a bien réglé l'intégralité de sa cotisation annuelle pour la pratique du tennis au sein de notre structure pour la période du 01/09/2026 au 31/08/2027.

Détail des sommes acquittées :
${formulaType === 'cours' 
  ? `• Cours collectifs / École de tennis (cotisation club & accès courts compris) : ${partClub} €` 
  : `• Cotisation club / Accès aux courts : ${partClub} €`}
• Licence Fédération Française de Tennis (FFT) n° ${adherent.licence || 'Licence Club FFT'} : ${nLicence} €
• Total perçu : ${totalPercu} € TTC (Association non assujettie à la TVA selon l’article 261-7-1° du Code Général des Impôts)

${showModalitesPaiement ? `Modalités de règlement :
• Date d’encaissement : ${datePaiement}
• Mode de règlement : ${effectiveModeStr}

` : ''}La présente attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit, notamment auprès de son employeur, de son Comité Social et Économique (CSE) ou de sa complémentaire santé. Elle ne constitue pas un reçu fiscal ouvrant droit à une réduction d'impôt au titre des dons (article 200 du CGI).

Fait à ${editClub.ville || 'Muzillac'}, le ${dateJourStr}.

${editClub.signataireNom || editClub.president || 'Raphaël EVAIN'}
${editClub.signataireFonction || 'Président du TCM'}
[Signature et cachet officiel de l'association]`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      
      {/* Styles d'impression et d'affichage papier : fond 100% blanc et texte 100% noir pour une lisibilité parfaite */}
      <style>{`
        #attestation-printable-card {
          background-color: #ffffff !important;
          color: #000000 !important;
        }
        #attestation-printable-card, #attestation-printable-card * {
          color: #000000 !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #attestation-printable-card, #attestation-printable-card * {
            visibility: visible;
          }
          #attestation-printable-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 1.8cm 1.5cm;
            box-shadow: none !important;
            border: none !important;
            color: #000000 !important;
            background-color: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl bg-[#141820] text-zinc-100 rounded-3xl border border-[#272e3b] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col print:max-h-none print:overflow-visible print:bg-white print:border-none print:rounded-none">
        
        {/* Banner de confirmation de téléchargement PDF */}
        {pdfSuccessMessage && (
          <div className="no-print bg-emerald-500/20 border-b border-emerald-500/40 p-3 px-4 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shrink-0 animate-fadeIn">
            <span>{pdfSuccessMessage}</span>
            <button
              onClick={() => setPdfSuccessMessage(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* =================================================================== */}
        {/* BARRE D'OUTILS SUPÉRIEURE UNIQUE (Bandeau du bas supprimé selon la demande) */}
        {/* =================================================================== */}
        <div className="no-print p-3.5 sm:p-4 bg-[#171c26] border-b border-[#252c3a] flex items-center justify-between gap-2.5 shrink-0 flex-wrap">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-black text-white text-sm sm:text-base truncate">
                Attestation Officielle • {adherent.nomPrenom}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 flex-wrap">
            <button
              onClick={() => setIsEditingClubInfo(!isEditingClubInfo)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                isEditingClubInfo 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : 'bg-[#1e2430] hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
              title="Personnaliser les informations, logo et signature du club dans Club_Info"
            >
              <Settings2 className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Modifier Club_Info</span>
            </button>

            <button
              onClick={handleShareEmail}
              className="px-3 py-1.5 rounded-xl bg-sky-800/80 hover:bg-sky-700 text-sky-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Partager l'attestation par Email"
            >
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Email</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Partager l'attestation sur WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
              title="Fermer la modale"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PANNEAU D'ÉDITION DES PARAMÈTRES CLUB_INFO (Masqué à l'impression) */}
        {/* =================================================================== */}
        {isEditingClubInfo && (
          <div className="no-print p-4 sm:p-5 bg-[#181e2b] border-b border-[#2d3648] space-y-4 shrink-0 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-orange-400" />
                <h3 className="font-heading font-black text-sm text-white">
                  Informations administratives & Images (Onglet Club_Info de Données_appli)
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400">
                Sauvegarde permanente dans Google Sheets
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Nom officiel de l'association</label>
                <input
                  type="text"
                  value={editClub.nom || ''}
                  onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, nom: e.target.value }))}
                  className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none"
                  placeholder="Tennis Club de Muzillac"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Nom & Prénom du Signataire</label>
                <input
                  type="text"
                  value={editClub.signataireNom || ''}
                  onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, signataireNom: e.target.value }))}
                  className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none"
                  placeholder="Gilles LE BOURNOT"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Qualité / Fonction</label>
                <input
                  type="text"
                  value={editClub.signataireFonction || ''}
                  onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, signataireFonction: e.target.value }))}
                  className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none"
                  placeholder="Président"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Numéro RNA (ex: W563001859)</label>
                <input
                  type="text"
                  value={editClub.rna || ''}
                  onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, rna: e.target.value }))}
                  className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none font-mono"
                  placeholder="W563001859"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Numéro SIRET (14 chiffres)</label>
                <input
                  type="text"
                  value={editClub.siret || ''}
                  onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, siret: e.target.value }))}
                  className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none font-mono"
                  placeholder="439 123 456 00012"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Numéro d'affiliation FFT</label>
                <input
                  type="text"
                  value={editClub.codeClub || ''}
                  onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, codeClub: e.target.value }))}
                  className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none font-mono"
                  placeholder="52 56 0212"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Siège social / Adresse</label>
                <input
                  type="text"
                  value={editClub.adresse || ''}
                  onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, adresse: e.target.value }))}
                  className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none"
                  placeholder="Complexe du Clos des Moines, Rue du Stade"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Code Postal & Ville</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editClub.codePostal || ''}
                    onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, codePostal: e.target.value }))}
                    className="w-20 bg-[#10131a] border border-zinc-700 rounded-xl px-2.5 py-2 text-white focus:border-orange-500 outline-none font-mono"
                    placeholder="56190"
                  />
                  <input
                    type="text"
                    value={editClub.ville || ''}
                    onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, ville: e.target.value }))}
                    className="flex-1 bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none"
                    placeholder="Muzillac"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Contact Téléphone & Email</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editClub.telephone || ''}
                    onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, telephone: e.target.value }))}
                    className="w-1/2 bg-[#10131a] border border-zinc-700 rounded-xl px-2.5 py-2 text-white focus:border-orange-500 outline-none"
                    placeholder="02 97 41 67 80"
                  />
                  <input
                    type="email"
                    value={editClub.email || ''}
                    onChange={(e) => setEditClub((prev: ClubInfo) => ({ ...prev, email: e.target.value }))}
                    className="w-1/2 bg-[#10131a] border border-zinc-700 rounded-xl px-2.5 py-2 text-white focus:border-orange-500 outline-none"
                    placeholder="tennisclubmuzillac@gmail.com"
                  />
                </div>
              </div>

              {/* Téléversements d'images : Logo, Signature, Tampon */}
              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Logo officiel du Club</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-[#10131a] hover:bg-[#1a202c] border border-zinc-700 rounded-xl px-3 py-1.5 text-zinc-300 text-xs flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-orange-400" />
                    <span>{editClub.logoUrl ? 'Changer logo' : 'Téléverser logo'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload('logoUrl', e)} />
                  </label>
                  {editClub.logoUrl && (
                    <img src={editClub.logoUrl} alt="Logo" className="w-8 h-8 rounded object-contain bg-white p-0.5 border border-zinc-700" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Signature du Signataire</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-[#10131a] hover:bg-[#1a202c] border border-zinc-700 rounded-xl px-3 py-1.5 text-zinc-300 text-xs flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-orange-400" />
                    <span>{editClub.signatureUrl ? 'Changer signature' : 'Téléverser signature'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload('signatureUrl', e)} />
                  </label>
                  {editClub.signatureUrl && (
                    <img src={editClub.signatureUrl} alt="Signature" className="w-8 h-8 rounded object-contain bg-white p-0.5 border border-zinc-700" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Cachet / Tampon du Club</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-[#10131a] hover:bg-[#1a202c] border border-zinc-700 rounded-xl px-3 py-1.5 text-zinc-300 text-xs flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-orange-400" />
                    <span>{editClub.tamponUrl ? 'Changer tampon' : 'Téléverser tampon'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload('tamponUrl', e)} />
                  </label>
                  {editClub.tamponUrl && (
                    <img src={editClub.tamponUrl} alt="Tampon" className="w-8 h-8 rounded object-contain bg-white p-0.5 border border-zinc-700" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveClubInfo}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Enregistré dans Club_Info !</span>
                  </>
                ) : isSaving ? (
                  <span>Enregistrement en cours...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Enregistrer dans l'onglet Club_Info</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* BARRE DE SÉLECTION DE LA FORMULE ET DES MONTANTS (Soit l'un soit l'autre) */}
        {/* =================================================================== */}
        <div className="no-print p-3 sm:px-5 bg-[#10131a] border-b border-[#212734] space-y-2.5 text-xs">
          
          {/* Ligne 1 : Choix de la formule (Règle TCM : Le prix des cours comprend l'adhésion) */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">Formule souscrite :</span>
              
              <label className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer transition border flex items-center gap-1.5 ${
                formulaType === 'cours' 
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/50' 
                  : 'bg-black/40 text-zinc-400 border-zinc-700 hover:text-white'
              }`}>
                <input
                  type="radio"
                  name="formulaType"
                  checked={formulaType === 'cours'}
                  onChange={() => setFormulaType('cours')}
                  className="accent-orange-500"
                />
                <span>Cours collectifs (comprend l'adhésion)</span>
              </label>

              <label className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer transition border flex items-center gap-1.5 ${
                formulaType === 'adh_seule' 
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/50' 
                  : 'bg-black/40 text-zinc-400 border-zinc-700 hover:text-white'
              }`}>
                <input
                  type="radio"
                  name="formulaType"
                  checked={formulaType === 'adh_seule'}
                  onChange={() => setFormulaType('adh_seule')}
                  className="accent-orange-500"
                />
                <span>Cotisation club seule / Pratique libre</span>
              </label>
            </div>

            {/* Total calculé */}
            <div className="flex items-center gap-1.5 bg-orange-500/10 px-3 py-1 rounded-xl border border-orange-500/30 ml-auto">
              <span className="text-orange-300 font-bold uppercase text-[11px]">Total Perçu :</span>
              <strong className="text-orange-400 font-mono font-black text-sm">{totalPercu} €</strong>
            </div>
          </div>

          {/* Ligne 2 : Édition directe des montants correspondants */}
          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-zinc-800/80">
            {formulaType === 'cours' ? (
              <div className="flex items-center gap-1.5 bg-[#171c26] px-2.5 py-1 rounded-xl border border-zinc-800">
                <span className="text-zinc-400 font-medium">Prix des cours (inclut adhésion) :</span>
                <input
                  type="number"
                  value={coursAmount}
                  onChange={(e) => setCoursAmount(e.target.value)}
                  className="w-16 bg-black/60 border border-zinc-700 rounded px-1.5 py-0.5 text-white font-bold text-center"
                />
                <span className="text-zinc-400">€</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-[#171c26] px-2.5 py-1 rounded-xl border border-zinc-800">
                <span className="text-zinc-400 font-medium">Cotisation club seule :</span>
                <input
                  type="number"
                  value={cotisationAmount}
                  onChange={(e) => setCotisationAmount(e.target.value)}
                  className="w-16 bg-black/60 border border-zinc-700 rounded px-1.5 py-0.5 text-white font-bold text-center"
                />
                <span className="text-zinc-400">€</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-[#171c26] px-2.5 py-1 rounded-xl border border-zinc-800">
              <span className="text-zinc-400 font-medium">Licence FFT :</span>
              <input
                type="number"
                value={licenceFft}
                onChange={(e) => setLicenceFft(e.target.value)}
                className="w-14 bg-black/60 border border-zinc-700 rounded px-1.5 py-0.5 text-white font-bold text-center"
              />
              <span className="text-zinc-400">€</span>
            </div>

            {/* Option pour rendre les modalités de règlement facultatives */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300 font-semibold text-[11px] select-none">
                <input
                  type="checkbox"
                  checked={showModalitesPaiement}
                  onChange={(e) => setShowModalitesPaiement(e.target.checked)}
                  className="rounded accent-orange-500"
                />
                <span>Afficher les modalités de règlement</span>
              </label>
            </div>
          </div>

          {/* Ligne 3 (conditionnelle) : Détails d'encaissement si la section modalités de règlement est cochée */}
          {showModalitesPaiement && (
            <div className="flex items-center gap-3 flex-wrap pt-1.5 border-t border-zinc-800/80 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span>Règlement :</span>
                <select
                  value={modeReglement}
                  onChange={(e) => setModeReglement(e.target.value)}
                  className="bg-[#171c26] border border-zinc-700 rounded px-2 py-0.5 text-white focus:outline-none cursor-pointer"
                >
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Carte bancaire (HelloAsso)">Carte bancaire (HelloAsso)</option>
                  <option value="Pass'Sport">Pass'Sport</option>
                  <option value="Chèques vacances ANCV">Chèques vacances ANCV</option>
                  <option value="Espèces">Espèces</option>
                  <option value="autre">Autre...</option>
                </select>
                {modeReglement === 'autre' && (
                  <input
                    type="text"
                    value={customModeReglement}
                    onChange={(e) => setCustomModeReglement(e.target.value)}
                    placeholder="Préciser..."
                    className="bg-[#171c26] border border-orange-500/60 rounded px-2 py-0.5 text-white w-28"
                  />
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span>Date d'encaissement :</span>
                <input
                  type="text"
                  value={datePaiement}
                  onChange={(e) => setDatePaiement(e.target.value)}
                  className="bg-[#171c26] border border-zinc-700 rounded px-2 py-0.5 text-white w-24 text-center font-mono"
                />
              </div>

              {(isMinor || representantLegal) && (
                <div className="flex items-center gap-1.5">
                  <span>Parent / Représentant :</span>
                  <input
                    type="text"
                    value={representantLegal}
                    onChange={(e) => setRepresentantLegal(e.target.value)}
                    placeholder="Nom du parent..."
                    className="bg-[#171c26] border border-zinc-700 rounded px-2 py-0.5 text-white w-36"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* CORPS DU DOCUMENT OFFICIEL (Feuille A4 épurée noir sur blanc, sans bulle ni badge) */}
        {/* =================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-200 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          <div 
            id="attestation-printable-card"
            className="w-full max-w-2xl bg-white text-black p-8 sm:p-12 space-y-6 border border-zinc-300 shadow-xl print:shadow-none print:border-none print:p-0 print:rounded-none font-sans"
          >
            
            {/* 1. EN-TÊTE DU CLUB SANS BULLE NI COULEUR PÂLE */}
            <div className="flex items-start justify-between border-b-2 border-black pb-5 gap-4">
              
              <div className="flex items-start space-x-4">
                {/* Logo du club avec nettoyage automatique du fond via mix-blend-mode */}
                <div className="shrink-0">
                  {editClub.logoUrl ? (
                    <img 
                      src={editClub.logoUrl} 
                      alt="Logo du club" 
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                      style={{ mixBlendMode: 'multiply', filter: 'contrast(125%) brightness(102%)' }}
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-black text-black flex flex-col items-center justify-center font-heading font-black">
                      <span className="text-xl sm:text-2xl leading-none">TCM</span>
                      <span className="text-[9px] uppercase tracking-wider mt-0.5">Muzillac</span>
                    </div>
                  )}
                </div>

                {/* Coordonnées administratives complètes du club */}
                <div className="space-y-0.5 text-xs text-black leading-snug">
                  <h2 className="text-base sm:text-lg font-heading font-black tracking-tight text-black uppercase">
                    {editClub.nom || 'Tennis Club de Muzillac'}
                  </h2>
                  <p className="font-semibold text-black">
                    Association loi 1901 à but non lucratif
                  </p>
                  <p>
                    Siège social : {editClub.adresse || 'Complexe du Clos des Moines, Rue du Stade'}
                  </p>
                  <p>
                    Code postal et Ville : {editClub.codePostal || '56190'} {editClub.ville || 'Muzillac'}
                  </p>
                  <p className="font-mono text-[11px]">
                    Numéro RNA : <strong>{editClub.rna || 'W563001859'}</strong>
                    {editClub.siret && <> • Numéro SIRET : <strong>{editClub.siret}</strong></>}
                  </p>
                  <p className="font-mono text-[11px]">
                    Numéro d'affiliation FFT : <strong>{editClub.codeClub || '52 56 0212'}</strong>
                  </p>
                  <p className="text-[11px] text-black">
                    Contact : {editClub.telephone || '02 97 41 67 80'} | {editClub.email || 'tennisclubmuzillac@gmail.com'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. TITRE DU DOCUMENT */}
            <div className="text-center py-2 space-y-1">
              <h1 className="text-lg sm:text-xl font-heading font-black uppercase tracking-wider text-black border-b-2 border-black pb-1.5 inline-block px-4">
                ATTESTATION DE PAIEMENT DE COTISATION SPORTIVE
              </h1>
              <p className="text-xs sm:text-sm font-black text-black uppercase tracking-wide">
                Saison sportive 2026 / 2027
              </p>
            </div>

            {/* 3. DÉCLARATION & IDENTIFICATION DU BÉNÉFICIAIRE */}
            <div className="space-y-4 text-xs sm:text-sm text-black leading-relaxed text-justify">
              <p>
                Je soussigné, <strong>{editClub.signataireNom || editClub.president || 'Raphaël EVAIN'}</strong>, agissant en qualité de <strong>{editClub.signataireFonction || 'Président'}</strong> de l’association <strong>{editClub.nom || 'Tennis Club de Muzillac'}</strong>, dûment habilité à délivrer la présente attestation, certifie que :
              </p>

              {/* Fiche adhérent épurée (simple encadré noir sur fond blanc) */}
              <div className="p-4 bg-white rounded-none border border-black space-y-1.5 text-xs">
                <p>
                  <span className="font-semibold text-black">Mme / M. :</span>{' '}
                  <strong className="text-black text-sm font-bold">{adherent.nomPrenom}</strong>
                </p>
                <p>
                  <span className="font-semibold text-black">Né(e) le :</span>{' '}
                  <strong className="text-black">{adherent.dateNaissance || 'Non renseignée'}{birthYear ? ` (${2027 - birthYear} ans)` : ''}</strong>
                </p>
                <p>
                  <span className="font-semibold text-black">Demeurant au :</span>{' '}
                  <span className="text-black font-medium">{adresseAdherent}</span>
                </p>
                {(isMinor || representantLegal) && (
                  <p className="pt-1 border-t border-black">
                    <span className="text-black italic block text-[11px]">(L'attestation concerne un enfant mineur :)</span>
                    <span className="font-semibold text-black">Représentant légal :</span>{' '}
                    <strong className="text-black">{representantLegal || 'Parent payeur'}</strong>
                  </p>
                )}
              </div>

              <p>
                a bien réglé l'intégralité de sa cotisation annuelle pour la pratique du tennis au sein de notre structure pour la période du <strong>01/09/2026</strong> au <strong>31/08/2027</strong>.
              </p>

              {/* 4. DÉTAIL DES SOMMES ACQUITTÉES (SOIT N'L'UN SOIT L'AUTRE) */}
              <div className="space-y-1.5 pt-1">
                <p className="font-bold text-black uppercase tracking-wide text-xs">
                  Détail des sommes acquittées :
                </p>
                <div className="bg-white p-3.5 rounded-none border border-black space-y-1.5 text-xs">
                  {formulaType === 'cours' ? (
                    <div className="flex justify-between items-center py-0.5 border-b border-black">
                      <span>• Cours collectifs / École de tennis (cotisation club & accès courts compris) :</span>
                      <strong className="font-mono text-black">{partClub} €</strong>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center py-0.5 border-b border-black">
                      <span>• Cotisation club / Accès aux courts :</span>
                      <strong className="font-mono text-black">{partClub} €</strong>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-0.5 border-b border-black">
                    <span>• Licence Fédération Française de Tennis (FFT) n° <span className="font-mono">{adherent.licence || 'Club'}</span> :</span>
                    <strong className="font-mono text-black">{licenceFft} €</strong>
                  </div>

                  <div className="flex justify-between items-center pt-1.5 text-sm font-black text-black">
                    <span className="uppercase">• Total perçu :</span>
                    <strong className="font-mono text-black text-base">{totalPercu} € TTC</strong>
                  </div>
                  <p className="text-[10px] text-black italic pt-1">
                    (Association non assujettie à la TVA selon l’article 261-7-1° du Code Général des Impôts)
                  </p>
                </div>
              </div>

              {/* 5. MODALITÉS DE RÈGLEMENT (FACULTATIVES) */}
              {showModalitesPaiement && (
                <div className="space-y-1 pt-1 text-xs">
                  <p className="font-bold text-black uppercase tracking-wide">
                    Modalités de règlement :
                  </p>
                  <div className="bg-white p-3 rounded-none border border-black space-y-1 text-xs">
                    <p>• Date d’encaissement : <strong>{datePaiement}</strong></p>
                    <p>• Mode de règlement : <strong>{effectiveModeStr}</strong></p>
                  </div>
                </div>
              )}

              {/* 6. USAGE DE DROIT ET MENTIONS LÉGALES EXACTES */}
              <p className="text-[11px] text-black italic text-justify leading-snug border-l-2 border-black pl-3 pt-1">
                La présente attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit, notamment auprès de son employeur, de son Comité Social et Économique (CSE) ou de sa complémentaire santé. Elle ne constitue pas un reçu fiscal ouvrant droit à une réduction d'impôt au titre des dons (article 200 du CGI).
              </p>
            </div>

            {/* 7. CLÔTURE, DATE, SIGNATURE ET CACHET OFFICIEL */}
            <div className="pt-3 border-t-2 border-black flex items-center justify-between gap-4 text-xs">
              
              <div className="space-y-0.5 text-black">
                <p>Fait à <strong>{editClub.ville || 'Muzillac'}</strong>, le {dateJourStr}.</p>
              </div>

              {/* Bloc Signature et Tampon officiel (nettoyage fond automatique, largeur tampon ~5cm) */}
              <div className="flex items-center justify-end gap-4 shrink-0">
                {editClub.tamponUrl && (
                  <img 
                    src={editClub.tamponUrl} 
                    alt="Tampon officiel TCM" 
                    className="w-[185px] max-w-[5cm] h-auto object-contain shrink-0" 
                    style={{ mixBlendMode: 'multiply', filter: 'contrast(125%) brightness(102%)' }}
                  />
                )}

                {editClub.signatureUrl ? (
                  <img 
                    src={editClub.signatureUrl} 
                    alt="Signature officielle" 
                    className="w-[150px] max-w-[4cm] h-auto object-contain shrink-0" 
                    style={{ mixBlendMode: 'multiply', filter: 'contrast(125%) brightness(102%)' }}
                  />
                ) : (
                  <div className="w-32 h-14 border border-dashed border-black rounded-none flex flex-col items-center justify-center p-1 bg-white">
                    <span className="text-[10px] font-bold text-black uppercase tracking-wider">
                      Signature & Cachet
                    </span>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
