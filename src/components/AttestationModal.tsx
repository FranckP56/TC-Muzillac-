import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Settings2, 
  Upload, 
  Building, 
  Save, 
  FileText,
  Download,
  Loader2,
  Send,
  UserCheck,
  RotateCcw,
  Plus,
  Trash2,
  Lock
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Adherent, ClubInfo, UserRole } from '../types/tennis';
import { extractBirthYear } from '../utils/fftEligibility';

const LOCAL_SIGNATAIRE_KEY = 'tcm_attestation_local_signataire_v2';

const PAYMENT_MODES = [
  'Carte bancaire (HelloAsso)',
  'Chèque',
  'Virement bancaire',
  "Pass'Sport",
  'Chèques vacances ANCV',
  'Espèces',
] as const;

interface ReglementItem {
  id: string;
  mode: string;
  customMode?: string;
  montant?: string;
  precision?: string;
}

/**
 * Compresse automatiquement une image téléversée pour qu'elle tienne dans la limite
 * de 50 000 caractères par cellule de Google Sheets (< 30 Ko en base64)
 */
async function compressImageFile(file: File, maxWidth = 350, maxHeight = 350, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Essai en PNG pour conserver la transparence
        const png = canvas.toDataURL('image/png');
        if (png.length < 32000) {
          resolve(png);
        } else {
          // Sinon JPEG avec compression
          const jpeg = canvas.toDataURL('image/jpeg', quality);
          resolve(jpeg);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

interface AttestationModalProps {
  adherent: Adherent;
  clubInfo: ClubInfo;
  userRole?: UserRole;
  onClose: () => void;
  onSaveClubInfo?: (info: ClubInfo) => Promise<void> | void;
}

export const AttestationModal: React.FC<AttestationModalProps> = ({
  adherent,
  clubInfo,
  userRole = 'adherent',
  onClose,
  onSaveClubInfo,
}) => {
  const canIssueAttestation = userRole === 'admin' || userRole === 'bureau';
  const [isEditingClubInfo, setIsEditingClubInfo] = useState(false);
  const [editSection, setEditSection] = useState<'club' | 'signataire'>('club');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [signataireSaveSuccess, setSignataireSaveSuccess] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  // Formulaire Club_Info (stocké de façon partagée dans l'onglet Club_Info de Données_appli)
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
    signataireNom: clubInfo.signataireNom || clubInfo.president || 'Raphaël EVAIN',
    signataireFonction: clubInfo.signataireFonction || 'Président',
  });

  // Profil du signataire spécifique à ce poste / appareil (ex: secrétaire, trésorier, etc.)
  const [localSignataire, setLocalSignataire] = useState<{
    nom: string;
    fonction: string;
    civilite: 'Je soussigné' | 'Je soussignée';
    signatureUrl: string;
    isCustom: boolean;
  }>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SIGNATAIRE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.nom || parsed.signatureUrl)) {
          return {
            nom: parsed.nom || '',
            fonction: parsed.fonction || 'Secrétaire du TCM',
            civilite: parsed.civilite || 'Je soussigné',
            signatureUrl: parsed.signatureUrl || '',
            isCustom: true,
          };
        }
      }
    } catch {
      // Ignorer
    }
    return {
      nom: clubInfo.signataireNom || clubInfo.president || 'Raphaël EVAIN',
      fonction: clubInfo.signataireFonction || 'Président du TCM',
      civilite: 'Je soussigné',
      signatureUrl: clubInfo.signatureUrl || '',
      isCustom: false,
    };
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

  // Modalités de règlement (facultatives, avec possibilité de préciser plusieurs modes)
  const [showModalitesPaiement, setShowModalitesPaiement] = useState<boolean>(false);
  const [datePaiement, setDatePaiement] = useState<string>(() => {
    return new Date().toLocaleDateString('fr-FR');
  });
  const [reglements, setReglements] = useState<ReglementItem[]>([
    { id: 'reg-1', mode: 'Carte bancaire (HelloAsso)', montant: '', precision: '' },
  ]);

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

  // Gestion des différents modes de règlement
  const getReglementLabel = (item: ReglementItem): string => {
    if (item.mode === 'autre') {
      return (item.customMode || '').trim() || 'Autre mode';
    }
    return item.mode;
  };

  const handleToggleQuickMode = (modeName: string) => {
    setReglements((prev) => {
      const exists = prev.some((r) => r.mode === modeName);
      if (exists) {
        if (prev.length === 1) return prev;
        return prev.filter((r) => r.mode !== modeName);
      }
      return [...prev, { id: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, mode: modeName, montant: '', precision: '' }];
    });
  };

  const handleAddReglementLine = () => {
    setReglements((prev) => [
      ...prev,
      { id: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, mode: 'Chèque', montant: '', precision: '' },
    ]);
  };

  const handleUpdateReglement = (id: string, patch: Partial<ReglementItem>) => {
    setReglements((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleRemoveReglement = (id: string) => {
    setReglements((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const totalReglementsSaisis = reglements.reduce((acc, r) => acc + (parseFloat(r.montant || '') || 0), 0);
  const hasAnyReglementMontant = reglements.some((r) => (r.montant || '').trim() !== '');

  // Définition du signataire effectif pour le document
  const effectiveSignataireNom = localSignataire.nom || editClub.signataireNom || editClub.president || 'Raphaël EVAIN';
  const effectiveSignataireFonction = localSignataire.fonction || editClub.signataireFonction || 'Président du TCM';
  const effectiveSignataireFormule = localSignataire.civilite || 'Je soussigné';
  const effectiveSignatureUrl = localSignataire.signatureUrl || editClub.signatureUrl || '';

  // Gestion du téléversement d'image du Club (Logo, Tampon) avec compression automatique
  const handleFileUpload = async (field: 'logoUrl' | 'tamponUrl', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 350, 350, 0.82);
      setEditClub((prev: ClubInfo) => ({ ...prev, [field]: compressed }));
    } catch (err) {
      console.warn("Erreur compression image club:", err);
    }
  };

  // Téléversement de la signature du signataire local
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 350, 200, 0.85);
      setLocalSignataire(prev => ({ ...prev, signatureUrl: compressed, isCustom: true }));
    } catch (err) {
      console.warn("Erreur compression signature:", err);
    }
  };

  // Sauvegarde des données officielles du club dans Club_Info (GSheet Données_appli)
  const handleSaveClubInfo = async () => {
    setIsSaving(true);
    try {
      if (onSaveClubInfo) {
        await onSaveClubInfo(editClub);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (e) {
      console.warn("Erreur sauvegarde ClubInfo:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Sauvegarde du signataire local (spécifique à l'appareil de l'utilisateur)
  const handleSaveLocalSignataire = () => {
    try {
      localStorage.setItem(LOCAL_SIGNATAIRE_KEY, JSON.stringify(localSignataire));
      setSignataireSaveSuccess(true);
      setTimeout(() => setSignataireSaveSuccess(false), 2000);
    } catch (e) {
      console.warn("Erreur sauvegarde signataire local:", e);
    }
  };

  // Rétablissement du signataire par défaut (Président Raphaël EVAIN)
  const handleResetLocalSignataire = () => {
    try {
      localStorage.removeItem(LOCAL_SIGNATAIRE_KEY);
    } catch {
      // Ignorer
    }
    setLocalSignataire({
      nom: editClub.president || 'Raphaël EVAIN',
      fonction: 'Président du TCM',
      civilite: 'Je soussigné',
      signatureUrl: editClub.signatureUrl || '',
      isCustom: false,
    });
    setSignataireSaveSuccess(true);
    setTimeout(() => setSignataireSaveSuccess(false), 2000);
  };

  // Construction du fichier PDF A4 officiel (non modifiable)
  const buildPdfFile = async (): Promise<{ pdf: jsPDF; fileName: string; file: File } | null> => {
    const element = document.getElementById('attestation-printable-card');
    if (!element) return null;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: 900,
      windowHeight: 2400,
      onclone: (clonedDoc, clonedElement) => {
        // Préserver les balises <style> éventuelles avant de masquer le reste du DOM cloné
        const inlineStyles = Array.from(clonedDoc.body.querySelectorAll('style'));
        inlineStyles.forEach((styleEl) => {
          clonedDoc.head.appendChild(styleEl);
        });

        // Masquer la modale, le backdrop et tous les conteneurs overflow/fixed
        Array.from(clonedDoc.body.children).forEach((child) => {
          (child as HTMLElement).style.display = 'none';
        });

        clonedDoc.documentElement.style.margin = '0';
        clonedDoc.documentElement.style.padding = '0';
        clonedDoc.documentElement.style.overflow = 'visible';
        clonedDoc.documentElement.style.height = 'auto';
        clonedDoc.documentElement.style.background = '#ffffff';

        clonedDoc.body.style.margin = '0';
        clonedDoc.body.style.padding = '0';
        clonedDoc.body.style.overflow = 'visible';
        clonedDoc.body.style.height = 'auto';
        clonedDoc.body.style.width = '900px';
        clonedDoc.body.style.background = '#ffffff';

        // Placer la carte imprimable seule directement dans body à (0, 0) sans aucune contrainte d'ascenseur
        clonedDoc.body.appendChild(clonedElement);
        clonedElement.style.display = 'block';
        clonedElement.style.position = 'static';
        clonedElement.style.width = '760px';
        clonedElement.style.maxWidth = '760px';
        clonedElement.style.minHeight = '0';
        clonedElement.style.height = 'auto';
        clonedElement.style.margin = '0';
        clonedElement.style.padding = '40px';
        clonedElement.style.border = 'none';
        clonedElement.style.boxShadow = 'none';
        clonedElement.style.transform = 'none';
        clonedElement.style.overflow = 'visible';
        clonedElement.style.backgroundColor = '#ffffff';
        clonedElement.style.color = '#000000';

        // Nettoyer les filtres/mixBlendMode CSS sur les images pour un rendu PDF fidèle
        const imgs = clonedElement.querySelectorAll('img');
        imgs.forEach((img) => {
          img.style.mixBlendMode = 'normal';
          img.style.filter = 'none';
        });
      },
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 4;
    const marginY = 4;
    const ratio = Math.min((pageWidth - marginX * 2) / canvas.width, (pageHeight - marginY * 2) / canvas.height);
    const renderWidth = canvas.width * ratio;
    const renderHeight = canvas.height * ratio;
    const offsetX = (pageWidth - renderWidth) / 2;

    pdf.addImage(imgData, 'PNG', offsetX, marginY, renderWidth, renderHeight);
    const safeName = (adherent.nomPrenom || 'Adherent').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Attestation_Paiement_TCM_${safeName}.pdf`;
    const blob = pdf.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });

    return { pdf, fileName, file };
  };

  // Téléchargement direct du fichier PDF A4 non modifiable
  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);
    try {
      const built = await buildPdfFile();
      if (!built) return;
      built.pdf.save(built.fileName);
      setPdfSuccessMessage(`✓ Fichier PDF "${built.fileName}" téléchargé (format non modifiable).`);
    } catch (err) {
      console.warn('Erreur génération PDF :', err);
      setPdfSuccessMessage('Impossible de générer le PDF pour le moment. Veuillez réessayer.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Envoi exclusif via fichier PDF (Partage système avec pièce jointe PDF, ou téléchargement PDF + mail d'accompagnement)
  const handleSendPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);
    try {
      const built = await buildPdfFile();
      if (!built) return;

      const { pdf, fileName, file } = built;

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] }) &&
        typeof navigator.share === 'function'
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `Attestation de paiement - ${adherent.nomPrenom}`,
            text: `Attestation officielle de paiement de cotisation sportive (${editClub.nom || 'Tennis Club de Muzillac'}).`,
          });
          setPdfSuccessMessage(`✓ Attestation PDF "${fileName}" prête pour l'envoi.`);
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            return;
          }
          // Poursuite vers le téléchargement PDF + messagerie si le partage natif échoue
        }
      }

      // Secours fiable : téléchargement immédiat du PDF + ouverture de la messagerie avec un mot d'accompagnement (sans texte modifiable de l'attestation)
      pdf.save(fileName);
      const subject = encodeURIComponent(`Attestation de paiement de cotisation (PDF) - ${adherent.nomPrenom} - ${editClub.nom || 'Tennis Club de Muzillac'}`);
      const coverBody = encodeURIComponent(
        `Bonjour ${adherent.nomPrenom},\n\nVeuillez trouver ci-joint votre attestation officielle de paiement de cotisation sportive pour la saison 2026 / 2027 au format PDF.\n\nBien sportivement,\n${effectiveSignataireNom}\n${effectiveSignataireFonction}\n${editClub.nom || 'Tennis Club de Muzillac'}`
      );
      const mailTo = adherent.email || '';
      window.location.href = `mailto:${mailTo}?subject=${subject}&body=${coverBody}`;
      setPdfSuccessMessage(`✓ PDF "${fileName}" téléchargé : joignez ce fichier à l'e-mail qui vient de s'ouvrir.`);
    } catch (err) {
      console.warn('Erreur envoi PDF :', err);
      setPdfSuccessMessage('Impossible de préparer le fichier PDF pour l’envoi.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const accordHabilite = effectiveSignataireFormule === 'Je soussignée' ? 'habilitée' : 'habilité';

  if (!canIssueAttestation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="w-full max-w-md bg-[#141820] border border-rose-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="font-heading font-black text-white text-lg">
            Accès réservé aux membres du Bureau
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            La délivrance et l'envoi des attestations officielles de paiement de cotisation (au format PDF) sont strictement réservés au Président, au Secrétaire, au Trésorier et à l'Administrateur du club.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

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
        {/* BARRE D'OUTILS SUPÉRIEURE UNIQUE */}
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
              <p className="text-[11px] text-zinc-400 truncate">
                Délivrée par un membre du Bureau • Format PDF non modifiable uniquement
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsEditingClubInfo(!isEditingClubInfo)}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer whitespace-nowrap ${
                isEditingClubInfo 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : 'bg-[#1e2430] hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
              title="Paramètres du club et choix du signataire (Président, Secrétaire, Trésorier)"
            >
              <Settings2 className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Paramètres</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleGeneratePdf}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
              title="Télécharger l'attestation officielle en PDF"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" /> : <Download className="w-3.5 h-3.5 text-emerald-400" />}
              <span>Télécharger PDF</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleSendPdf}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white transition flex items-center gap-1.5 text-xs font-black cursor-pointer disabled:opacity-50 shadow-md shadow-orange-950/40 whitespace-nowrap"
              title="Envoyer l'attestation exclusivement en fichier PDF"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Envoyer le PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition flex items-center justify-center cursor-pointer"
              title="Fermer la modale"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PANNEAU D'ÉDITION AVEC ONGLETS : CLUB (GSHEET) vs SIGNATAIRE (LOCAL) */}
        {/* =================================================================== */}
        {isEditingClubInfo && (
          <div className="no-print p-4 sm:p-5 bg-[#181e2b] border-b border-[#2d3648] space-y-4 shrink-0 max-h-96 overflow-y-auto animate-fadeIn">
            
            {/* Onglets de sélection du panneau */}
            <div className="flex items-center gap-2 border-b border-[#2d3648] pb-3 flex-wrap">
              <button
                type="button"
                onClick={() => setEditSection('club')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  editSection === 'club'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-orange-400" />
                <span>1. Données du Club (Enregistrées sur Google Sheet)</span>
              </button>

              <button
                type="button"
                onClick={() => setEditSection('signataire')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  editSection === 'signataire'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>2. Signataire de l'attestation (Profil sur cet appareil)</span>
              </button>
            </div>

            {/* SECTION 1 : DONNÉES DU CLUB (GOOGLE SHEETS CLUB_INFO) */}
            {editSection === 'club' && (
              <div className="space-y-3">
                <div className="p-2.5 bg-orange-500/10 border border-orange-500/25 rounded-xl text-[11px] text-orange-200 leading-snug">
                  ℹ️ Ces données (RNA, SIRET, logo, tampon) sont <strong>partagées avec tous les membres</strong> et synchronisées directement dans l'onglet <strong>Club_Info</strong> de votre Google Sheet <em>Données_appli</em>.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
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

                  {/* Téléversements d'images avec compression automatique pour GSheet */}
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
                    <label className="block text-zinc-400 mb-1 font-semibold">Cachet / Tampon officiel du Club</label>
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
                        <span>Enregistré dans Club_Info (GSheet) !</span>
                      </>
                    ) : isSaving ? (
                      <span>Enregistrement sur Google Sheets...</span>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Enregistrer dans l'onglet Club_Info (GSheet)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 2 : SIGNATAIRE LOCAL (PRÉSIDENT / SECRÉTAIRE / TRÉSORIER) */}
            {editSection === 'signataire' && (
              <div className="space-y-3">
                <div className="p-2.5 bg-purple-500/10 border border-purple-500/25 rounded-xl text-[11px] text-purple-200 leading-snug">
                  ✍️ <strong>Signataire habilité du club :</strong> Sélectionnez votre fonction au sein du Bureau (Président, Secrétaire, Trésorier) et ajoutez votre signature. Ce profil reste enregistré <strong>uniquement sur votre appareil</strong>.
                </div>

                {(editClub.president || editClub.secretaire || editClub.tresorier) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[11px] text-zinc-400 font-semibold">Sélection rapide (Bureau) :</span>
                    {editClub.president && (
                      <button
                        type="button"
                        onClick={() =>
                          setLocalSignataire((prev) => ({
                            ...prev,
                            nom: editClub.president,
                            fonction: 'Président du TCM',
                            civilite: 'Je soussigné',
                            isCustom: true,
                          }))
                        }
                        className="px-2.5 py-1 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/35 text-orange-200 font-bold transition cursor-pointer whitespace-nowrap"
                      >
                        Président ({editClub.president})
                      </button>
                    )}
                    {editClub.secretaire && (
                      <button
                        type="button"
                        onClick={() =>
                          setLocalSignataire((prev) => ({
                            ...prev,
                            nom: editClub.secretaire,
                            fonction: 'Secrétaire du TCM',
                            isCustom: true,
                          }))
                        }
                        className="px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/35 text-purple-200 font-bold transition cursor-pointer whitespace-nowrap"
                      >
                        Secrétaire ({editClub.secretaire})
                      </button>
                    )}
                    {editClub.tresorier && (
                      <button
                        type="button"
                        onClick={() =>
                          setLocalSignataire((prev) => ({
                            ...prev,
                            nom: editClub.tresorier,
                            fonction: 'Trésorier du TCM',
                            isCustom: true,
                          }))
                        }
                        className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-200 font-bold transition cursor-pointer whitespace-nowrap"
                      >
                        Trésorier ({editClub.tresorier})
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Formule d'accord</label>
                    <select
                      value={localSignataire.civilite}
                      onChange={(e) => setLocalSignataire(prev => ({ ...prev, civilite: e.target.value as any, isCustom: true }))}
                      className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-purple-500 outline-none cursor-pointer"
                    >
                      <option value="Je soussigné">Je soussigné (Masculin)</option>
                      <option value="Je soussignée">Je soussignée (Féminin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Nom & Prénom du Signataire</label>
                    <input
                      type="text"
                      value={localSignataire.nom}
                      onChange={(e) => setLocalSignataire(prev => ({ ...prev, nom: e.target.value, isCustom: true }))}
                      className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-purple-500 outline-none"
                      placeholder="Ex: Raphaël EVAIN ou Marie DUPONT"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Qualité / Fonction</label>
                    <input
                      type="text"
                      value={localSignataire.fonction}
                      onChange={(e) => setLocalSignataire(prev => ({ ...prev, fonction: e.target.value, isCustom: true }))}
                      className="w-full bg-[#10131a] border border-zinc-700 rounded-xl px-3 py-2 text-white focus:border-purple-500 outline-none"
                      placeholder="Ex: Secrétaire du TCM, Présidente, etc."
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-zinc-400 mb-1 font-semibold">Signature du signataire (image)</label>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 cursor-pointer bg-[#10131a] hover:bg-[#1a202c] border border-zinc-700 rounded-xl px-4 py-2 text-zinc-300 text-xs flex items-center justify-center gap-2">
                        <Upload className="w-4 h-4 text-purple-400" />
                        <span>{localSignataire.signatureUrl ? 'Changer ma signature' : 'Téléverser ma signature'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                      </label>
                      {localSignataire.signatureUrl && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-zinc-700">
                          <img src={localSignataire.signatureUrl} alt="Signature" className="h-8 max-w-[120px] object-contain" />
                          <button
                            type="button"
                            onClick={() => setLocalSignataire(prev => ({ ...prev, signatureUrl: '', isCustom: true }))}
                            className="text-zinc-500 hover:text-rose-500 text-xs ml-1"
                            title="Supprimer la signature"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResetLocalSignataire}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Revenir au Président par défaut (Raphaël EVAIN)"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Rétablir le Président par défaut</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveLocalSignataire}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    {signataireSaveSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Signataire enregistré sur cet appareil !</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Enregistrer mon profil de signataire (local)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

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

            {(isMinor || representantLegal) && (
              <div className="flex items-center gap-1.5 bg-[#171c26] px-2.5 py-1 rounded-xl border border-zinc-800">
                <span className="text-zinc-400 font-medium">Parent / Représentant :</span>
                <input
                  type="text"
                  value={representantLegal}
                  onChange={(e) => setRepresentantLegal(e.target.value)}
                  placeholder="Nom du parent..."
                  className="bg-black/60 border border-zinc-700 rounded px-2 py-0.5 text-white w-36"
                />
              </div>
            )}

            {/* Option pour afficher et détailler les modalités / modes de règlement */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300 font-semibold text-[11px] select-none">
                <input
                  type="checkbox"
                  checked={showModalitesPaiement}
                  onChange={(e) => setShowModalitesPaiement(e.target.checked)}
                  className="rounded accent-orange-500"
                />
                <span>Préciser les modalités de règlement</span>
              </label>
            </div>
          </div>

          {/* Ligne 3 (conditionnelle) : Date d'encaissement et détail des différents modes de règlement */}
          {showModalitesPaiement && (
            <div className="space-y-2.5 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-zinc-400 font-semibold">Modes utilisés :</span>
                  {PAYMENT_MODES.map((modeLabel) => {
                    const isActive = reglements.some((r) => r.mode === modeLabel);
                    return (
                      <button
                        key={modeLabel}
                        type="button"
                        onClick={() => handleToggleQuickMode(modeLabel)}
                        className={`px-2 py-1 rounded-lg font-bold border transition cursor-pointer whitespace-nowrap ${
                          isActive
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
                            : 'bg-[#171c26] text-zinc-400 border-zinc-700 hover:text-white'
                        }`}
                      >
                        {modeLabel}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400">Date d'encaissement :</span>
                  <input
                    type="text"
                    value={datePaiement}
                    onChange={(e) => setDatePaiement(e.target.value)}
                    className="bg-[#171c26] border border-zinc-700 rounded-lg px-2 py-1 text-white w-24 text-center font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                {reglements.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[#171c26] p-2 rounded-xl border border-zinc-800"
                  >
                    <select
                      value={item.mode}
                      onChange={(e) => handleUpdateReglement(item.id, { mode: e.target.value })}
                      className="bg-[#0e1218] border border-zinc-700 rounded-lg px-2 py-1 text-white focus:outline-none cursor-pointer"
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="autre">Autre...</option>
                    </select>

                    {item.mode === 'autre' && (
                      <input
                        type="text"
                        value={item.customMode || ''}
                        onChange={(e) => handleUpdateReglement(item.id, { customMode: e.target.value })}
                        placeholder="Préciser le mode..."
                        className="bg-[#0e1218] border border-orange-500/60 rounded-lg px-2 py-1 text-white w-36"
                      />
                    )}

                    <input
                      type="text"
                      value={item.precision || ''}
                      onChange={(e) => handleUpdateReglement(item.id, { precision: e.target.value })}
                      placeholder="Précision (ex: en 3 fois, n° chèque...)"
                      className="flex-1 min-w-[140px] bg-[#0e1218] border border-zinc-700 rounded-lg px-2 py-1 text-white placeholder-zinc-500"
                    />

                    <div className="flex items-center gap-1 bg-[#0e1218] border border-zinc-700 rounded-lg px-2 py-1">
                      <input
                        type="number"
                        value={item.montant || ''}
                        onChange={(e) => handleUpdateReglement(item.id, { montant: e.target.value })}
                        placeholder="Montant"
                        className="w-16 bg-transparent text-white font-mono text-right focus:outline-none"
                      />
                      <span className="text-zinc-400">€</span>
                    </div>

                    {reglements.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveReglement(item.id)}
                        className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 transition cursor-pointer"
                        title="Supprimer ce mode de règlement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleAddReglementLine}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-400" />
                  <span>Ajouter un autre règlement</span>
                </button>

                {hasAnyReglementMontant && (
                  <span
                    className={`font-mono font-bold ${
                      Math.round(totalReglementsSaisis) === Math.round(nMain)
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                    }`}
                  >
                    Somme ventilée : {totalReglementsSaisis.toFixed(0)} € / {totalPercu} €
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* CORPS DU DOCUMENT OFFICIEL (Feuille A4 épurée noir sur blanc, sans bulle ni badge) */}
        {/* =================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-200 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          <div 
            id="attestation-printable-card"
            className="w-full max-w-2xl bg-white text-black p-8 sm:p-12 space-y-6 border border-[#d4d4d8] shadow-xl print:shadow-none print:border-none print:p-0 print:rounded-none font-sans"
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
                {effectiveSignataireFormule}, <strong>{effectiveSignataireNom}</strong>, agissant en qualité de <strong>{effectiveSignataireFonction}</strong> de l’association <strong>{editClub.nom || 'Tennis Club de Muzillac'}</strong>, dûment {accordHabilite} à délivrer la présente attestation, certifie que :
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
                  <p className="pt-1.5">
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
                <div className="bg-white p-3.5 rounded-none border border-black space-y-2 text-xs">
                  {formulaType === 'cours' ? (
                    <div className="flex justify-between items-center py-0.5 gap-3">
                      <span>• Cours collectifs / École de tennis (cotisation club & accès courts compris) :</span>
                      <strong className="font-mono text-black shrink-0">{partClub} €</strong>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center py-0.5 gap-3">
                      <span>• Cotisation club / Accès aux courts :</span>
                      <strong className="font-mono text-black shrink-0">{partClub} €</strong>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-0.5 gap-3">
                    <span>• Licence Fédération Française de Tennis (FFT) n° <span className="font-mono">{adherent.licence || 'Club'}</span> :</span>
                    <strong className="font-mono text-black shrink-0">{licenceFft} €</strong>
                  </div>

                  <div className="flex justify-between items-center pt-2 text-sm font-black text-black">
                    <span className="uppercase">• Total perçu :</span>
                    <strong className="font-mono text-black text-base shrink-0">{totalPercu} € TTC</strong>
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
                    {reglements.length === 1 && !reglements[0].montant && !reglements[0].precision ? (
                      <p>• Mode de règlement : <strong>{getReglementLabel(reglements[0])}</strong></p>
                    ) : (
                      <div className="space-y-0.5">
                        <p>• {reglements.length > 1 ? 'Modes de règlement :' : 'Mode de règlement :'}</p>
                        <ul className="pl-4 space-y-0.5">
                          {reglements.map((item) => {
                            const label = getReglementLabel(item);
                            const precisionStr = (item.precision || '').trim();
                            const montantStr = (item.montant || '').trim();
                            return (
                              <li key={item.id}>
                                - <strong>{label}</strong>
                                {precisionStr ? ` (${precisionStr})` : ''}
                                {montantStr ? ` : ${montantStr} €` : ''}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
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

                {effectiveSignatureUrl ? (
                  <img 
                    src={effectiveSignatureUrl} 
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
