  // Fonction de lecture forcée et isolée sans cache pour le TCM Muzillac
  const handleLoadFromRealFile = async (isInitial = false) => {
    setIsLoadingFile(true);
    setFileLoadError(null);
    try {
      const currentTimestamp = Date.now();
      const targetSheetId = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
      
      // 1. URL Absolue et Directe pour l'onglet Adhérents
      const cleanAdherentsUrl = `https://google.com{targetSheetId}/gviz/tq?tqx=out:csv&sheet=Adherents&nocache=${currentTimestamp}`;
      
      const res = await fetch(cleanAdherentsUrl, { 
        method: "GET",
        headers: { "Cache-Control": "no-cache, no-store" },
        cache: "no-store" 
      });
      
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          const parsed = parseAdherentsCsv(text);
          if (parsed && parsed.length > 0) {
            const sorted = sortAdherentsByRankingDesc(parsed);
            setAdherents(sorted);
            localStorage.setItem('tcm_adherents_v2', JSON.stringify(sorted));
          }
        }
      }

      // 2. URL Absolue et Directe pour l'onglet Rencontres (Vos 85 Matchs)
      const cleanRencontresUrl = `https://google.com{targetSheetId}/gviz/tq?tqx=out:csv&sheet=Rencontres&nocache=${currentTimestamp}`;
      
      const resRec = await fetch(cleanRencontresUrl, { 
        method: "GET",
        headers: { "Cache-Control": "no-cache, no-store" },
        cache: "no-store" 
      });
      
      if (resRec.ok) {
        const textRec = await resRec.text();
        if (textRec && textRec.trim().length > 0) {
          const parsedRec = parseRencontresCsv(textRec);
          if (parsedRec && parsedRec.length > 0) {
            setRencontres(parsedRec);
            localStorage.setItem('tcm_rencontres_v3', JSON.stringify(parsedRec));
            setLastSyncTime(new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR'));
            localStorage.setItem('tcm_last_sync_v2', new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR'));
          }
        }
      }

    } catch (error: any) {
      console.error("Erreur de synchronisation Google Sheets :", error);
      setFileLoadError(error.message || "Erreur de connexion aux serveurs Google");
    } finally {
      setIsLoadingFile(false);
    }
  };
