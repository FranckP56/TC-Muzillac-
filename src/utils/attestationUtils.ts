import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Adherent, ClubInfo } from '../types/tennis';
import { extractBirthYear } from './fftEligibility';

export interface DeterministicAttestationPricing {
  birthYear: number | null;
  ageSportif: number | null;
  isMinor: boolean;
  formulaType: 'cours' | 'adh_seule';
  totalPercu: number;
  licenceFft: number;
  partClub: number;
  hasActiveRegistration: boolean;
}

/**
 * Calcule de manière déterministe et non modifiable les montants d'attestation
 * d'un adhérent à partir de sa fiche et de la grille officielle Club_Info.
 */
export function computeDeterministicAttestationPricing(
  adherent: Adherent,
  clubInfo: ClubInfo,
  saisonYear: string | number = 2027
): DeterministicAttestationPricing {
  const birthYear = extractBirthYear(adherent.dateNaissance);
  const seasonNum = parseInt(String(saisonYear), 10) || 2027;
  const ageSportif = birthYear ? seasonNum - birthYear : null;
  const isMinor = ageSportif !== null ? ageSportif < 18 : false;

  const groupe = (adherent.groupeEnseignement || '').toLowerCase();
  const formule = (adherent.formuleCours || '').toLowerCase();
  const combined = `${groupe} ${formule}`.trim();

  const isParentOnly =
    groupe.includes('parent') ||
    (adherent.typeLicence || '').toLowerCase().includes('parent');

  const isCours =
    !isParentOnly &&
    (Boolean(adherent.inscritEnCours) ||
      (groupe !== '' &&
        !groupe.includes('libre') &&
        !groupe.includes('sans cours')));

  const formulaType: 'cours' | 'adh_seule' = isCours ? 'cours' : 'adh_seule';

  const tarifs = Array.isArray(clubInfo?.tarifs) ? clubInfo.tarifs : [];

  // 1. Tarif global (cours collectifs OU cotisation club seule)
  let totalPercu = 0;
  if (formulaType === 'cours') {
    if (combined.includes('mini')) {
      const matchMini = tarifs.find((t) =>
        t.label.toLowerCase().includes('mini')
      );
      totalPercu = matchMini ? matchMini.montant : 140;
    } else if (combined.includes('compet') || combined.includes('compét')) {
      const matchComp = tarifs.find(
        (t) =>
          t.categorie === 'competition' ||
          t.label.toLowerCase().includes('compét') ||
          t.label.toLowerCase().includes('compet')
      );
      totalPercu = matchComp ? matchComp.montant : isMinor ? 250 : 330;
    } else if (
      isMinor ||
      combined.includes('jeune') ||
      combined.includes('ado') ||
      combined.includes('école') ||
      combined.includes('ecole')
    ) {
      const matchJeune = tarifs.find(
        (t) =>
          t.categorie === 'jeune' &&
          (t.label.toLowerCase().includes('cours') ||
            t.label.toLowerCase().includes('école') ||
            t.label.toLowerCase().includes('ecole'))
      );
      totalPercu = matchJeune ? matchJeune.montant : 200;
    } else {
      const matchAdulte = tarifs.find(
        (t) =>
          t.categorie === 'adulte' &&
          t.label.toLowerCase().includes('cours')
      );
      totalPercu = matchAdulte ? matchAdulte.montant : 330;
    }
  } else {
    const matchAdh = tarifs.find((t) => {
      const lbl = t.label.toLowerCase();
      const isAdh =
        (lbl.includes('cotisation') || lbl.includes('pratique libre')) &&
        !lbl.includes('cours');
      if (!isAdh) return false;
      return isMinor
        ? lbl.includes('jeune') || lbl.includes('enfant')
        : lbl.includes('adulte') || lbl.includes('senior');
    });
    totalPercu = matchAdh ? matchAdh.montant : isMinor ? 60 : 90;
  }

  // 2. Part licence FFT selon âge sportif
  let licenceFft = isMinor ? 23 : 33;
  if (ageSportif !== null && ageSportif <= 11) {
    licenceFft = 13;
  }
  if (tarifs.length > 0) {
    const matchLic = tarifs.find((t) => {
      const lbl = t.label.toLowerCase();
      if (!lbl.includes('licence')) return false;
      if (ageSportif !== null && ageSportif <= 11) {
        return lbl.includes('enfant') || lbl.includes('11');
      }
      if (isMinor) {
        return lbl.includes('jeune') || lbl.includes('12');
      }
      return lbl.includes('adulte') || lbl.includes('senior');
    });
    if (matchLic) {
      licenceFft = matchLic.montant;
    }
  }

  const partClub = Math.max(0, totalPercu - licenceFft);

  const hasValidLicence =
    Boolean((adherent.licence || '').trim()) &&
    !(adherent.typeLicence || '').toLowerCase().includes('sans licence');

  const hasActiveRegistration =
    hasValidLicence || Boolean(adherent.inscritEnCours) || isCours;

  return {
    birthYear,
    ageSportif,
    isMinor,
    formulaType,
    totalPercu,
    licenceFft,
    partClub,
    hasActiveRegistration,
  };
}

/**
 * Construit le PDF A4 officiel non modifiable à partir de l'élément DOM #attestation-printable-card
 */
export async function buildAttestationPdfFile(
  adherentNomPrenom: string,
  elementId: string = 'attestation-printable-card'
): Promise<{ pdf: jsPDF; fileName: string; file: File } | null> {
  const element = document.getElementById(elementId);
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
      const inlineStyles = Array.from(clonedDoc.body.querySelectorAll('style'));
      inlineStyles.forEach((styleEl) => {
        clonedDoc.head.appendChild(styleEl);
      });

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
  const ratio = Math.min(
    (pageWidth - marginX * 2) / canvas.width,
    (pageHeight - marginY * 2) / canvas.height
  );
  const renderWidth = canvas.width * ratio;
  const renderHeight = canvas.height * ratio;
  const offsetX = (pageWidth - renderWidth) / 2;

  pdf.addImage(imgData, 'PNG', offsetX, marginY, renderWidth, renderHeight);
  const safeName = (adherentNomPrenom || 'Adherent').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Attestation_Paiement_TCM_${safeName}.pdf`;
  const blob = pdf.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  return { pdf, fileName, file };
}
