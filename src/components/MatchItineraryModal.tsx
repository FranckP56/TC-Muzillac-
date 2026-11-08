import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  MapPin, 
  Navigation, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Compass,
  Calendar,
  Clock,
  Car
} from 'lucide-react';
import { Rencontre } from '../types/tennis';

interface MatchItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rencontre: Rencontre | null;
}

const TCM_HOME_ADDRESS = 'Complexe du Clos des Moines, Allée du Clos des Moines, 56190 Muzillac';

export const MatchItineraryModal: React.FC<MatchItineraryModalProps> = ({
  isOpen,
  onClose,
  rencontre,
}) => {
  const [copiedType, setCopiedType] = useState<'link' | 'address' | null>(null);

  if (!isOpen || !rencontre) return null;

  const isHome = (rencontre.clubAccueilNom || '').toLowerCase().includes('muzillac');
  const targetClubName = isHome ? (rencontre.clubAccueilNom || 'TC Muzillac') : (rencontre.clubAccueilNom || 'Club adverse');

  // Construction de l'adresse de destination
  const addressParts: string[] = [];
  if (isHome) {
    addressParts.push(TCM_HOME_ADDRESS);
  } else {
    if (rencontre.adresse1Installation && rencontre.adresse1Installation.trim()) {
      addressParts.push(rencontre.adresse1Installation.trim());
    }
    if (rencontre.adresse2Installation && rencontre.adresse2Installation.trim()) {
      addressParts.push(rencontre.adresse2Installation.trim());
    }
    const cpVille: string[] = [];
    if (rencontre.codePostalInstallation && rencontre.codePostalInstallation.trim()) {
      cpVille.push(rencontre.codePostalInstallation.trim());
    }
    if (rencontre.villeInstallation && rencontre.villeInstallation.trim()) {
      cpVille.push(rencontre.villeInstallation.trim());
    }
    if (cpVille.length > 0) {
      addressParts.push(cpVille.join(' '));
    }
    if (addressParts.length === 0) {
      // Fallback avec nom du club et ville
      addressParts.push(`Installations de tennis ${targetClubName}`);
      if (rencontre.villeInstallation) {
        addressParts.push(rencontre.villeInstallation);
      }
    }
  }

  const destinationAddress = addressParts.join(', ');
  const destinationQuery = `${targetClubName}, ${destinationAddress}`;

  // URLs d'itinéraires
  const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(TCM_HOME_ADDRESS)}&destination=${encodeURIComponent(destinationQuery)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(destinationQuery)}&navigate=yes`;
  const appleMapsUrl = `https://maps.apple.com/?saddr=${encodeURIComponent(TCM_HOME_ADDRESS)}&daddr=${encodeURIComponent(destinationQuery)}`;
  
  // URL iframe embed OSM / Google Maps embed
  const embedMapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destinationQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(googleMapsDirUrl);
      setCopiedType('link');
      setTimeout(() => setCopiedType(null), 2500);
    } catch (e) {
      console.warn('Impossible de copier le lien', e);
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(destinationAddress);
      setCopiedType('address');
      setTimeout(() => setCopiedType(null), 2500);
    } catch (e) {
      console.warn('Impossible de copier l\'adresse', e);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Itinéraire match • ${targetClubName}`,
      text: `Itinéraire pour la rencontre ${rencontre.numeroEquipe} face à ${targetClubName} (${destinationAddress}) :`,
      url: googleMapsDirUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-[#131720] border-2 border-zinc-700 rounded-3xl overflow-hidden shadow-2xl relative text-left my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête avec dégradé bleu ciel / orange */}
        <div className={`p-5 bg-gradient-to-r ${isHome ? 'from-amber-600/25 via-[#161a22] to-[#12151b] border-amber-500/30' : 'from-sky-600/25 via-[#161a22] to-[#12151b] border-sky-500/30'} border-b flex items-start justify-between shrink-0`}>
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border ${
              isHome 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
            }`}>
              {isHome ? <MapPin className="w-6 h-6" /> : <Navigation className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isHome 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                }`}>
                  {isHome ? 'Match à Domicile' : 'Match à l\'Extérieur'}
                </span>
                <span className="text-[10px] text-zinc-400 font-bold">
                  {rencontre.numeroEquipe}
                </span>
              </div>
              <h3 className="font-heading font-black text-white text-base sm:text-lg mt-0.5 truncate max-w-[280px] sm:max-w-md" title={targetClubName}>
                {targetClubName}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-black/30 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps de la modale avec défilement */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Fiche récapitulative Départ / Arrivée */}
          <div className="bg-[#0b0e14] p-4 rounded-2xl border border-zinc-800 space-y-3">
            {/* Départ */}
            <div className="flex items-start space-x-3">
              <div className="w-7 h-7 rounded-xl bg-orange-500/20 text-[#FF6D00] border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Compass className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider block">
                  Point de départ conseillé (Club)
                </span>
                <p className="text-xs font-semibold text-white mt-0.5">
                  Complexe du Clos des Moines, 56190 Muzillac
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-800/80 pt-3 flex items-start space-x-3">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                isHome 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
              }`}>
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider block">
                    {isHome ? 'Installations TCM' : 'Installations du club adverse'}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer flex items-center gap-1"
                  >
                    {copiedType === 'address' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Adresse copiée
                      </span>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copier l'adresse
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs font-bold text-white mt-0.5">
                  {destinationAddress}
                </p>
              </div>
            </div>

            {/* Infos de match (Date, Heure, Division) */}
            <div className="border-t border-zinc-800/80 pt-2.5 flex items-center justify-between text-[11px] text-zinc-400 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-white font-medium">{rencontre.dateRencontre}</span>
              </div>
              {rencontre.composition?.heureDebut && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-white font-medium">{rencontre.composition.heureDebut}</span>
                </div>
              )}
              {rencontre.division && (
                <span className="text-zinc-300 font-semibold bg-zinc-800 px-2 py-0.5 rounded-lg border border-zinc-700">
                  {rencontre.division}
                </span>
              )}
            </div>
          </div>

          {/* Boutons d'itinéraires GPS directs */}
          <div className="space-y-2">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
              Lancer l'itinéraire GPS en un clic
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Google Maps */}
              <a
                href={googleMapsDirUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-950/40 transition"
              >
                <Navigation className="w-4 h-4" />
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              {/* Waze */}
              <a
                href={wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-950/40 transition"
              >
                <Car className="w-4 h-4" />
                <span>Waze</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              {/* Apple Maps */}
              <a
                href={appleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-zinc-700 to-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <Compass className="w-4 h-4" />
                <span>Plans (Apple)</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>

          {/* Partage & Copie du lien d'itinéraire */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleShare}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Partager l'itinéraire avec l'équipe</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-zinc-700 transition cursor-pointer"
              title="Copier le lien Google Maps"
            >
              {copiedType === 'link' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Lien copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-zinc-400" />
                  <span className="hidden sm:inline">Copier le lien</span>
                </>
              )}
            </button>
          </div>

          {/* Carte interactive intégrée */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="font-bold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-sky-400" /> Aperçu cartographique
              </span>
              <span className="text-[10px] text-zinc-500">Vue directe</span>
            </div>
            <div className="w-full h-48 sm:h-56 rounded-2xl overflow-hidden border border-zinc-700 shadow-inner bg-[#0b0e14]">
              <iframe
                title="Carte itinéraire"
                width="100%"
                height="100%"
                loading="lazy"
                allowFullScreen
                src={embedMapsUrl}
                className="border-0 w-full h-full filter contrast-[0.95]"
              />
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="p-3 bg-[#0d1016] border-t border-zinc-800 flex items-center justify-between">
          <p className="text-[10px] text-zinc-500">
            Conseil : Partagez le lien avec vos coéquipiers pour le covoiturage.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
