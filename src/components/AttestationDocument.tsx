import React from 'react';
import { Adherent, ClubInfo } from '../types/tennis';

export interface AttestationReglementLine {
  id: string;
  mode: string;
  customMode?: string;
  montant?: string;
  precision?: string;
}

interface AttestationDocumentProps {
  id?: string;
  adherent: Adherent;
  clubInfo: ClubInfo;
  birthYear: number | null;
  adresseAdherent: string;
  representantLegal: string;
  isMinor: boolean;
  formulaType: 'cours' | 'adh_seule';
  partClub: number;
  licenceFft: number;
  totalPercu: number;
  signataireFormule?: string;
  signataireNom: string;
  signataireFonction: string;
  signatureUrl?: string;
  dateJourStr: string;
  showModalitesPaiement?: boolean;
  datePaiement?: string;
  reglements?: AttestationReglementLine[];
  saisonLabel?: string;
}

export const AttestationDocument: React.FC<AttestationDocumentProps> = ({
  id = 'attestation-printable-card',
  adherent,
  clubInfo,
  birthYear,
  adresseAdherent,
  representantLegal,
  isMinor,
  formulaType,
  partClub,
  licenceFft,
  totalPercu,
  signataireFormule = 'Je soussigné',
  signataireNom,
  signataireFonction,
  signatureUrl,
  dateJourStr,
  showModalitesPaiement = false,
  datePaiement = '',
  reglements = [],
  saisonLabel = '2026 / 2027',
}) => {
  const accordHabilite = signataireFormule === 'Je soussignée' ? 'habilitée' : 'habilité';

  const getReglementLabel = (item: AttestationReglementLine): string => {
    if (item.mode === 'autre') {
      return (item.customMode || '').trim() || 'Autre mode';
    }
    return item.mode;
  };

  return (
    <div
      id={id}
      className="w-full max-w-2xl bg-white text-black p-6 sm:p-10 space-y-6 border border-[#d4d4d8] shadow-xl print:shadow-none print:border-none print:p-0 print:rounded-none font-sans"
    >
      {/* 1. EN-TÊTE DU CLUB */}
      <div className="flex items-start justify-between border-b-2 border-black pb-5 gap-4">
        <div className="flex items-start space-x-4">
          <div className="shrink-0">
            {clubInfo.logoUrl ? (
              <img
                src={clubInfo.logoUrl}
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

          <div className="space-y-0.5 text-xs text-black leading-snug">
            <h2 className="text-base sm:text-lg font-heading font-black tracking-tight text-black uppercase">
              {clubInfo.nom || 'Tennis Club de Muzillac'}
            </h2>
            <p className="font-semibold text-black">Association loi 1901 à but non lucratif</p>
            <p>
              Siège social : {clubInfo.adresse || 'Complexe du Clos des Moines, Rue du Stade'}
            </p>
            <p>
              Code postal et Ville : {clubInfo.codePostal || '56190'} {clubInfo.ville || 'Muzillac'}
            </p>
            <p className="font-mono text-[11px]">
              Numéro RNA : <strong>{clubInfo.rna || 'W563001859'}</strong>
              {clubInfo.siret && (
                <>
                  {' '}
                  • Numéro SIRET : <strong>{clubInfo.siret}</strong>
                </>
              )}
            </p>
            <p className="font-mono text-[11px]">
              Numéro d'affiliation FFT : <strong>{clubInfo.codeClub || '52 56 0212'}</strong>
            </p>
            <p className="text-[11px] text-black">
              Contact : {clubInfo.telephone || '02 97 41 67 80'} |{' '}
              {clubInfo.email || 'tennisclubmuzillac@gmail.com'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. TITRE DU DOCUMENT */}
      <div className="text-center py-2 space-y-1">
        <h1 className="text-base sm:text-xl font-heading font-black uppercase tracking-wider text-black border-b-2 border-black pb-1.5 inline-block px-4">
          ATTESTATION DE PAIEMENT DE COTISATION SPORTIVE
        </h1>
        <p className="text-xs sm:text-sm font-black text-black uppercase tracking-wide">
          Saison sportive {saisonLabel}
        </p>
      </div>

      {/* 3. DÉCLARATION & IDENTIFICATION DU BÉNÉFICIAIRE */}
      <div className="space-y-4 text-xs sm:text-sm text-black leading-relaxed text-justify">
        <p>
          {signataireFormule}, <strong>{signataireNom}</strong>, agissant en qualité de{' '}
          <strong>{signataireFonction}</strong> de l’association{' '}
          <strong>{clubInfo.nom || 'Tennis Club de Muzillac'}</strong>, dûment {accordHabilite} à
          délivrer la présente attestation, certifie que :
        </p>

        <div className="p-4 bg-white rounded-none border border-black space-y-1.5 text-xs">
          <p>
            <span className="font-semibold text-black">Mme / M. :</span>{' '}
            <strong className="text-black text-sm font-bold">{adherent.nomPrenom}</strong>
          </p>
          <p>
            <span className="font-semibold text-black">Né(e) le :</span>{' '}
            <strong className="text-black">
              {adherent.dateNaissance || 'Non renseignée'}
              {birthYear ? ` (${2027 - birthYear} ans)` : ''}
            </strong>
          </p>
          <p>
            <span className="font-semibold text-black">Demeurant au :</span>{' '}
            <span className="text-black font-medium">{adresseAdherent}</span>
          </p>
          {(isMinor || representantLegal) && (
            <p className="pt-1.5">
              <span className="text-black italic block text-[11px]">
                (L'attestation concerne un enfant mineur :)
              </span>
              <span className="font-semibold text-black">Représentant légal :</span>{' '}
              <strong className="text-black">{representantLegal || 'Parent payeur'}</strong>
            </p>
          )}
        </div>

        <p>
          a bien réglé l'intégralité de sa cotisation annuelle pour la pratique du tennis au sein de
          notre structure pour la période du <strong>01/09/2026</strong> au{' '}
          <strong>31/08/2027</strong>.
        </p>

        {/* 4. DÉTAIL DES SOMMES ACQUITTÉES */}
        <div className="space-y-1.5 pt-1">
          <p className="font-bold text-black uppercase tracking-wide text-xs">
            Détail des sommes acquittées :
          </p>
          <div className="bg-white p-3.5 rounded-none border border-black space-y-2 text-xs">
            {formulaType === 'cours' ? (
              <div className="flex justify-between items-center py-0.5 gap-3">
                <span>
                  • Cours collectifs / École de tennis (cotisation club & accès courts compris) :
                </span>
                <strong className="font-mono text-black shrink-0">{partClub} €</strong>
              </div>
            ) : (
              <div className="flex justify-between items-center py-0.5 gap-3">
                <span>• Cotisation club / Accès aux courts :</span>
                <strong className="font-mono text-black shrink-0">{partClub} €</strong>
              </div>
            )}

            <div className="flex justify-between items-center py-0.5 gap-3">
              <span>
                • Licence Fédération Française de Tennis (FFT) n°{' '}
                <span className="font-mono">{adherent.licence || 'Club'}</span> :
              </span>
              <strong className="font-mono text-black shrink-0">{licenceFft} €</strong>
            </div>

            <div className="flex justify-between items-center pt-2 text-sm font-black text-black">
              <span className="uppercase">• Total perçu :</span>
              <strong className="font-mono text-black text-base shrink-0">
                {totalPercu.toFixed(0)} € TTC
              </strong>
            </div>
            <p className="text-[10px] text-black italic pt-1">
              (Association non assujettie à la TVA selon l’article 261-7-1° du Code Général des
              Impôts)
            </p>
          </div>
        </div>

        {/* 5. MODALITÉS DE RÈGLEMENT (FACULTATIVES) */}
        {showModalitesPaiement && reglements.length > 0 && (
          <div className="space-y-1 pt-1 text-xs">
            <p className="font-bold text-black uppercase tracking-wide">Modalités de règlement :</p>
            <div className="bg-white p-3 rounded-none border border-black space-y-1 text-xs">
              <p>
                • Date d’encaissement : <strong>{datePaiement}</strong>
              </p>
              {reglements.length === 1 && !reglements[0].montant && !reglements[0].precision ? (
                <p>
                  • Mode de règlement : <strong>{getReglementLabel(reglements[0])}</strong>
                </p>
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

        {/* 6. MENTIONS LÉGALES */}
        <p className="text-[11px] text-black italic text-justify leading-snug border-l-2 border-black pl-3 pt-1">
          La présente attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir
          ce que de droit, notamment auprès de son employeur, de son Comité Social et Économique
          (CSE) ou de sa complémentaire santé. Elle ne constitue pas un reçu fiscal ouvrant droit à
          une réduction d'impôt au titre des dons (article 200 du CGI).
        </p>
      </div>

      {/* 7. CLÔTURE, DATE, SIGNATURE ET CACHET OFFICIEL */}
      <div className="pt-3 border-t-2 border-black flex items-center justify-between gap-4 text-xs">
        <div className="space-y-0.5 text-black">
          <p>
            Fait à <strong>{clubInfo.ville || 'Muzillac'}</strong>, le {dateJourStr}.
          </p>
        </div>

        <div className="flex items-center justify-end gap-4 shrink-0">
          {clubInfo.tamponUrl && (
            <img
              src={clubInfo.tamponUrl}
              alt="Tampon officiel TCM"
              className="w-[155px] sm:w-[185px] max-w-[5cm] h-auto object-contain shrink-0"
              style={{ mixBlendMode: 'multiply', filter: 'contrast(125%) brightness(102%)' }}
            />
          )}

          {signatureUrl ? (
            <img
              src={signatureUrl}
              alt="Signature officielle"
              className="w-[125px] sm:w-[150px] max-w-[4cm] h-auto object-contain shrink-0"
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
  );
};
