# UNIPR Calendar

Aggiungi l'orario delle lezioni UNIPR al tuo calendario (Google, Apple, Outlook), scegliendo solo gli insegnamenti che segui.
Stesso funzionamento di [UniboCalendar](https://github.com/FrancescoBonzi/UniboCalendar), da cui deriva (licenza AGPL-3.0), adattato a **Cloudflare Pages (piano Free)**.

> 🌐 **Online:** https://uniprcalendar.pages.dev
>
> Sito indipendente, non affiliato a UNIPR. Gli orari vengono letti dal portale pubblico https://agendastudenti.unipr.it/.

## Come funziona

| Parte | Dove | Cosa fa |
|---|---|---|
| `public/` | file statici | Pagine `index.html` (Dipartimento → Corso → Anno → Curriculum), `corso.html` (scelta insegnamenti), `link.html` (Google/Apple) |
| `public/data/catalog.json` | file statico | Dipartimenti, corsi, anni, curricula, insegnamenti. Nessuna chiamata server per navigare il sito |
| `functions/ics.js` | Pages Function | `GET /ics?aa=…&c=…&a=…&l=…&alert=…` legge le lezioni dal portale UNIPR e restituisce il `.ics` |
| `scripts/build-catalog.mjs` | solo in build / GitHub Actions | Rigenera `catalog.json` |

- Nessun database: tutti i parametri stanno nel link del calendario.
- Il feed `.ics` ha `Cache-Control: public, max-age=7200` e usa la cache edge di Cloudflare: per 2 ore la stessa iscrizione non interroga UNIPR.
- Se il portale UNIPR è giù il feed risponde `503`, così i calendari tengono gli eventi già scaricati invece di cancellarli.

## Pubblicare su Cloudflare Pages

1. Crea un repository GitHub **pubblico** (la licenza AGPL richiede che il codice del sito sia disponibile) e caricaci questa cartella.
2. Cloudflare → Workers & Pages → Create → Pages → collega il repository.
3. Impostazioni build: *Framework preset* `None`, *Build command* vuoto, *Build output directory* `public`.
4. Deploy. La cartella `functions/` viene riconosciuta da sola.
5. Aggiorna il link «Codice sorgente» nel footer delle tre pagine HTML con l'indirizzo del tuo repository.

Il workflow `.github/workflows/catalog.yml` rigenera il catalogo ogni lunedì (e quando lo lanci a mano da GitHub → Actions) e lo committa: Cloudflare ripubblica da solo. A settembre prende automaticamente il nuovo anno accademico.

## Sviluppo

```bash
npm test             # test unitari (node:test)
npm run catalog      # rigenera public/data/catalog.json (~1 minuto)
npm run dev          # sito + Function in locale su http://localhost:8788
```

## Limiti noti

- Alcuni percorsi potrebbero non pubblicare l'orario sul portale UNIPR: il sito li mostra come «orario non disponibile».
- I link valgono per un anno accademico: a settembre lo studente deve generarne uno nuovo (come per UniboCalendar quando cambiano i codici del corso).
