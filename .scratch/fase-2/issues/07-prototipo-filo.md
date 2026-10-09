# Prototipo del filo nel cielo

Type: prototype
Status: resolved
Blocked by: 05

## Question

Un prototipo nel cielo 3D e nella vista List del filo deciso al ticket 05, su dati Base Set, da
guardare insieme prima di scrivere la specifica: linea, punti visitati, ritorno lungo il filo.

## Answer

Prototipo su `main` (9 ottobre 2026, sera), senza flag: il filo è sempre attivo.

- **Stato**: `apps/web/src/lib/thread.ts` (logica pura: passo nuovo solo se diverso dall'ultimo, 60
  passi al massimo, luminosità per età) e `state/thread-store.ts` (zustand, `sessionStorage` della
  scheda; a una ricarica le tappe tornano nel pannello e rientrano nel cielo quando si rivisitano,
  perché il cielo riparte dall'origine). Nessun dato lascia il browser.
- **Cielo**: `components/three/ThreadTrail.tsx`: scia di particelle argento (18 per tratto) che scorre
  dalla tappa più vecchia alla più nuova, più luminosa in testa a ogni tratto; una luce su ogni tappa.
  Ultime 12 tappe piene, le vecchie sfumano fino a un minimo. Le tappe fuori dal vicinato restano dove
  erano state disegnate (il layout è continuo: il nuovo focus parte dalla posizione precedente).
- **Vicinato**: quello precedente scompare come prima; filtri e profondità non toccano il filo.
- **Pannello "Your thread"** (in basso a sinistra, in 3D e in List): tappe in ordine, numerate,
  cliccabili; un clic riporta il focus lì e aggiunge un passo (il filo non si accorcia). "Clear" lo
  azzera. Backspace e Indietro invariati.
- **Test**: unitari in `lib/__tests__/thread.test.ts`; e2e in `e2e/thread.spec.ts` (tre spostamenti,
  ritorno dal pannello, profondità che non tocca il filo, ricarica della scheda).
- **Da guardare insieme**: la resa della scia nel cielo 3D (l'ambiente degli agenti la disegna solo
  in software, senza immagini); spessore, velocità e colore sono costanti in `ThreadTrail.tsx`.
