import React, { useEffect, useMemo, useRef, useState } from "react";


const loadGoogleScript = (apiKey) =>
  new Promise((resolve, reject) => {
    if (window.google?.maps?.places) return resolve();
    if (!apiKey) {
      console.error("[PlaceAutocomplete] Manca la API key!");
      return reject(new Error("Missing Google Maps API key"));
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&language=it`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });

/** Utility: estrai parti dell'indirizzo da address_components */
function parseAddressComponents(components = []) {
  const get = (type) =>
    components.find((c) => c.types.includes(type))?.long_name || "";

  const locality =
    get("locality") ||
    get("postal_town") ||
    get("administrative_area_level_3") ||
    get("sublocality_level_1") ||
    "";

  const admin2 = get("administrative_area_level_2"); // provincia
  const admin1 = get("administrative_area_level_1"); // regione
  const country = get("country");
  const countryCode =
    components.find((c) => c.types.includes("country"))?.short_name || "";

  let display = locality || admin2 || admin1 || country || "";
  if (display && country) {
    if (locality && admin2) display = `${locality}, ${admin2}, ${country}`;
    else if (locality && admin1) display = `${locality}, ${admin1}, ${country}`;
    else if (locality) display = `${locality}, ${country}`;
    else if (admin2) display = `${admin2}, ${country}`;
    else display = `${display}, ${country}`;
  }

  return { locality, admin2, admin1, country, countryCode, display };
}


export default function PlaceAutocomplete({
  value,
  onChangeText,
  onSelectPlace,
  placeholder = "Cerca città/paesino...",
  apiKey = "AIzaSyCus9eFEbj4DsruePbc1umQOV7h-vnsBUQ",
  className = "",
  restrictCountry = "it",
  types = "(cities)",
}) {
  const inputRef = useRef(null);
  const svcRef = useRef(null);  // AutocompleteService
  const psRef = useRef(null);   // PlacesService

  const [ready, setReady] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loadingPred, setLoadingPred] = useState(false);
  const [errPred, setErrPred] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  //FIX: sopprimi la prossima ricerca quando la modifica del testo è programmatica (selezione)
  const selectingRef = useRef(false);

  // Debounce helper
  const debounce = (fn, delay) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  // Carica script
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        console.debug("[PlaceAutocomplete] using key:", apiKey?.slice(0, 6) + "...");
        await loadGoogleScript(apiKey);
        if (!active) return;

        const { maps } = window.google;
        // AutocompleteService (predictions)
        svcRef.current = new maps.places.AutocompleteService();

        
        const dummy = document.createElement("div");
        psRef.current = new maps.places.PlacesService(dummy);

        setReady(true);
      } catch (e) {
        console.error("[PlaceAutocomplete] errore caricamento Google script:", e);
        setReady(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [apiKey]);

  // Richiesta predictions
  const requestPredictions = useMemo(
    () =>
      debounce((input) => {
        if (!ready || !svcRef.current) return;

        // Non effettuare nuove ricerche se stiamo selezionando programmaticamente
        if (selectingRef.current) return;

        const q = (input || "").trim();
        if (q.length < 2) {
          setPredictions([]);
          setOpen(false);
          setErrPred(null);
          return;
        }

        setLoadingPred(true);
        setErrPred(null);

        const req = {
          input: q,
          // Tipi: "(cities)" per città, "(regions)" per paesi/regioni, "geocode" per indirizzi
          types: [types],
        };
        if (restrictCountry) {
          req.componentRestrictions = { country: restrictCountry };
        }

        svcRef.current.getPlacePredictions(req, (preds, status) => {
          setLoadingPred(false);
          setHighlightIndex(-1);

          if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
            if (status === "ZERO_RESULTS") {
              setPredictions([]);
              setOpen(true);
              return;
            }
            setErrPred(`Errore Google Places: ${status}`);
            setPredictions([]);
            setOpen(false);
            return;
          }

          setPredictions(preds || []);
          setOpen(true);
        });
      }, 350),
    [ready, restrictCountry, types]
  );

  // Trigger per ricerca quando cambia il value
  useEffect(() => {
    if (!ready) return;

    // Skip se la modifica del value viene da una selezione programmatica
    if (selectingRef.current) return;

    requestPredictions(value || "");
  }, [value, ready, requestPredictions]);

  // Chiudi dropdown click-outside
  useEffect(() => {
    const handleClick = (e) => {
      if (!inputRef.current) return;
      if (!inputRef.current.parentElement?.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Quando seleziono una prediction -> chiedo i details
  const selectPrediction = (pred) => {
    if (!pred || !psRef.current) return;

    //Blocca la prossima ricerca che scatterebbe a causa dell'onChangeText
    selectingRef.current = true;

    // Aggiorno subito il testo mostrato e CHIUDO la dropdown
    const mainText = pred?.structured_formatting?.main_text || pred?.description || "";
    onChangeText?.(pred?.description || mainText || "");
    setOpen(false);
    setPredictions([]);      // pulisci lista
    setHighlightIndex(-1);


    psRef.current.getDetails(
      {
        placeId: pred.place_id,
        fields: ["formatted_address", "address_components", "geometry", "name"],
      },
      (details, status) => {
        const done = () => {
          //Rilascia il flag con un piccolo ritardo
          setTimeout(() => {
            selectingRef.current = false;
          }, 200);
        };

        if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
          console.error("[PlaceAutocomplete] getDetails status:", status, details);
          onSelectPlace?.({
            formattedAddress: pred?.description || mainText || "",
            placeId: pred.place_id || null,
            lat: null,
            lng: null,
            addrParts: {
              locality: "",
              admin2: "",
              admin1: "",
              country: "",
              countryCode: "",
              display: pred?.description || mainText || "",
            },
          });
          done();
          return;
        }

        const loc = details?.geometry?.location;
        const lat = loc?.lat?.() ?? null;
        const lng = loc?.lng?.() ?? null;
        const addrParts = parseAddressComponents(details?.address_components || []);
        const formattedAddress =
          details?.formatted_address ||
          details?.name ||
          pred?.description ||
          mainText ||
          "";

        onChangeText?.(formattedAddress);
        onSelectPlace?.({
          formattedAddress,
          placeId: pred.place_id || null,
          lat,
          lng,
          addrParts,
        });

        done();
      }
    );
  };

  // Tastiera sulla input
  const onKeyDown = (e) => {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % predictions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? predictions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (highlightIndex >= 0 && highlightIndex < predictions.length) {
        e.preventDefault();
        selectPrediction(predictions[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChangeText?.(e.target.value)}
        onFocus={() => {
          //Non aprire se siamo in fase di selezione programmatica
          if (!selectingRef.current && predictions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={
          className ||
          "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
        }
        autoComplete="off"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-[9999] max-h-64 overflow-auto">
          {loadingPred && (
            <div className="px-3 py-2 text-sm text-gray-500">Caricamento…</div>
          )}
          {errPred && (
            <div className="px-3 py-2 text-sm text-red-600">{errPred}</div>
          )}
          {!loadingPred && !errPred && predictions.length === 0 && (value || "").trim().length >= 2 && (
            <div className="px-3 py-2 text-sm text-gray-500">Nessun risultato</div>
          )}
          {predictions.map((p, idx) => {
            const main = p.structured_formatting?.main_text || "";
            const sec = p.structured_formatting?.secondary_text || "";
            return (
              <button
                key={p.place_id}
                type="button"
                onMouseEnter={() => setHighlightIndex(idx)}
                onMouseLeave={() => setHighlightIndex(-1)}
                onClick={() => selectPrediction(p)}
                className={`w-full text-left px-3 py-2 text-sm ${
                  idx === highlightIndex ? "bg-gray-100" : "hover:bg-gray-50"
                }`}
              >
                <div className="font-medium truncate">{main || p.description}</div>
                {sec ? (
                  <div className="text-xs text-gray-500 truncate">{sec}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}