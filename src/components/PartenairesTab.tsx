import React, { useMemo, useState } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { PartenaireLogo, UserRole } from '../types/tennis';
import {
  getDisplayPartnersForCarousel,
  normalizePartnerSiteUrl,
} from '../utils/partnerLogos';
import { PartenairesModal } from './PartenairesModal';

interface PartenairesTabProps {
  partenaires: PartenaireLogo[];
  userRole: UserRole;
  gasUrl?: string;
  onRefreshPartenaires: () => Promise<void>;
}

type RoleFilter = 'all' | 'club' | 'proshop';

export const PartenairesTab: React.FC<PartenairesTabProps> = ({
  partenaires,
  userRole,
  gasUrl,
  onRefreshPartenaires,
}) => {
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});

  const canManage = userRole === 'admin' || userRole === 'bureau';
  const items = useMemo(() => getDisplayPartnersForCarousel(partenaires), [partenaires]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'club') return items.filter((p) => p.role === 'club');
    return items.filter((p) => p.role === 'boutique' || p.role === 'offre_magasin');
  }, [items, filter]);

  const hasClub = items.some((p) => p.role === 'club');
  const hasProshop = items.some((p) => p.role === 'boutique' || p.role === 'offre_magasin');

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="font-heading font-black text-white text-xl sm:text-2xl tracking-tight">
          Partenaires
        </h1>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsManageOpen(true)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#141820] hover:bg-zinc-800 border border-[#252b37] text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Link2 className="w-3.5 h-3.5 text-[#FF6D00] shrink-0" />
            <span>Gérer logos &amp; liens</span>
          </button>
        )}
      </div>

      {hasClub && hasProshop && (
        <div className="inline-flex items-center gap-1 p-1 bg-[#141820] border border-[#252b37] rounded-xl">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-[#E65100] text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Tous
          </button>
          <button
            type="button"
            onClick={() => setFilter('club')}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filter === 'club'
                ? 'bg-[#E65100] text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Club
          </button>
          <button
            type="button"
            onClick={() => setFilter('proshop')}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filter === 'proshop'
                ? 'bg-[#E65100] text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Boutique
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {filteredItems.map((partner) => {
          const safeUrl = normalizePartnerSiteUrl(partner.siteUrl);
          const isBroken = Boolean(brokenIds[partner.id]);

          const tile = (
            <div className="h-24 sm:h-28 rounded-2xl bg-white p-3.5 flex items-center justify-center relative group/logo shadow-sm">
              {partner.logoUrl && !isBroken ? (
                <img
                  src={partner.logoUrl}
                  alt={partner.nom}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setBrokenIds((prev) => ({ ...prev, [partner.id]: true }))
                  }
                  className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover/logo:scale-105"
                />
              ) : (
                <span className="text-xs font-bold text-zinc-800 text-center">
                  {partner.nom}
                </span>
              )}

              {safeUrl && (
                <ExternalLink
                  aria-hidden="true"
                  className="w-3.5 h-3.5 text-zinc-500 absolute top-2 right-2 opacity-60 group-hover/logo:opacity-100 group-hover/logo:text-[#E65100] transition"
                />
              )}
            </div>
          );

          return safeUrl ? (
            <a
              key={partner.id}
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={partner.nom}
              aria-label={partner.nom}
              className="block rounded-2xl hover:ring-2 hover:ring-[#FF6D00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6D00] transition"
            >
              {tile}
            </a>
          ) : (
            <div key={partner.id} title={partner.nom}>
              {tile}
            </div>
          );
        })}
      </div>

      {canManage && (
        <PartenairesModal
          isOpen={isManageOpen}
          onClose={() => setIsManageOpen(false)}
          partenaires={partenaires}
          gasUrl={gasUrl}
          onRefreshPartenaires={onRefreshPartenaires}
          defaultRole="club"
        />
      )}
    </div>
  );
};
