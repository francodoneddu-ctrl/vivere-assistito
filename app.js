const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>Array.from(document.querySelectorAll(sel));


// Apply affiliate URLs from window.AFF_LINKS to any <a> elements with data-affkey.
// If a URL is missing or marked as "DA DEFINIRE", the link points to affiliazioni.html#in-attivazione.
function applyAffiliateLinks(){
  try{
    const map = (window.AFF_LINKS && typeof window.AFF_LINKS === 'object') ? window.AFF_LINKS : {};
    const pickUrl = (val)=>{
      if(!val) return "";
      if(typeof val === 'string') return val;
      if(Array.isArray(val)){
        for(const it of val){
          const u = (it && (it.url||it.href||"")) ? String(it.url||it.href).trim() : "";
          if(u && u.toUpperCase() !== 'DA DEFINIRE') return u;
        }
        return "";
      }
      if(typeof val === 'object'){
        const u = (val.url||val.href||"") ? String(val.url||val.href).trim() : "";
        return (u && u.toUpperCase() !== 'DA DEFINIRE') ? u : "";
      }
      return "";
    };
    document.querySelectorAll('a[data-affkey]').forEach(a=>{
      const k = a.getAttribute('data-affkey');
      if(!k) return;
      const v = pickUrl(map[k]);
      if(!v){
        a.setAttribute('href', 'affiliazioni.html#in-attivazione');
        a.setAttribute('aria-disabled','true');
      }else{
        a.setAttribute('href', v);
        a.removeAttribute('aria-disabled');
      }
    });
  }catch(e){
    // Never allow affiliate mapping to break the page.
  }
}


function getAffiliateLinks(profile, focus){
  // Link destinations are resolved via window.AFF_LINKS using data-affkey.
  // Here we only define the *suggested categories* (copy + labels).
  const links = {
    MOBILITA: [
      {label:"Luce notturna con sensore (corridoio)", why:"Riduce cadute notturne e disorientamento.", href:"#"},
      {label:"Tappeto/strisce antiscivolo per zone critiche", why:"Minimizza scivolamenti in punti ripetuti.", href:"#"},
      {label:"Supporto deambulazione indoor (rollator compatto)", why:"Se serve appoggio stabile, meglio compatibile con porte/corridoi.", href:"#"}
    ],
    BAGNO: [
      {label:"Antiscivolo doccia + tappeto ad alta aderenza", why:"Prima misura contro scivolamenti in ambiente bagnato.", href:"#"},
      {label:"Rialzo WC con stabilità laterale", why:"Facilita alzata/seduta riducendo rischio.", href:"#"},
      {label:"Seduta doccia stabile (se spazio lo consente)", why:"Riduce fatica e instabilità durante doccia.", href:"#"}
    ],
    LETTO: [
      {label:"Luce notturna + percorso libero", why:"Riduce rischi nei trasferimenti notturni.", href:"#"},
      {label:"Sponda/maniglia per alzarsi dal letto", why:"Aiuta l’alzata in sicurezza e riduce movimenti bruschi.", href:"#"},
      {label:"Seduta stabile vicino al letto (con braccioli)", why:"Permette pause sicure e riduce instabilità.", href:"#"},
      {label:"Tappeto ad alta aderenza lato discesa", why:"Migliora grip ai piedi del letto se necessario.", href:"#"},
      {label:"Cuscino triangolare / schienale letto", why:"Supporta postura e comfort, riducendo sforzi inutili.", href:"#"},
      {label:"Tavolino servitore letto regolabile", why:"Oggetti a portata: meno spostamenti e meno rischi.", href:"#"}
    ]
  };
  return links[focus] || links.BAGNO;
}

function trackClick(key){
  try{
    const raw = localStorage.getItem('va_clicks') || "{}";
    const obj = JSON.parse(raw);
    obj[key] = (obj[key]||0) + 1;
    localStorage.setItem('va_clicks', JSON.stringify(obj));
  }catch(e){}
}

function computeProfile(answers){
  const counts = {A:0,B:0,C:0};
  answers.forEach(a=>{ if(counts[a]!==undefined) counts[a]++; });
  const q2 = answers[1], q3 = answers[2];
  if(counts.C >= 6 || (q3==='C' && q2==='C')) return "ASSISTITO";
  if(counts.B >= counts.A && counts.B >= counts.C) return "SUPPORTATO";
  return "AUTONOMO";
}

function computeFocus(answers){
  const q11 = answers[10];
  if(q11==='A') return "MOBILITA";
  if(q11==='B') return "BAGNO";
  return "LETTO";
}

// Collect and validate quiz answers. Returns an array of answers if complete, otherwise null.
function collectQuizAnswers(){
  const required = $$('.q[data-q]').map(q=>{
    const name = q.getAttribute('data-q');
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
  });
  const missing = required.findIndex(v=>v===null);
  if(missing !== -1){
    const alert = $('#alert');
    if(alert){ alert.style.display='block'; alert.textContent = "Compila tutte le domande per ottenere le raccomandazioni."; }
    const firstMissing = $(`.q[data-q="q${missing+1}"]`);
    if(firstMissing) firstMissing.scrollIntoView({behavior:'smooth', block:'center'});
    return null;
  }
  return required;
}

// Persist payload safely (localStorage may be blocked on some browsers / file://).
function persistPostIctusPayload(payload){
  const json = JSON.stringify(payload);
  try { localStorage.setItem('va_postictus', json); return true; } catch(e) {}
  try { sessionStorage.setItem('va_postictus', json); return true; } catch(e) {}
  return false;
}

function navigateToResults(answers){
  const ans = (answers||[]).join('');
  const dest = `risultato-post-ictus.html?ans=${encodeURIComponent(ans)}#raccomandazioni`;
  try { window.location.assign(dest); } catch(e) { window.location.href = dest; }
}

function clearQuiz(){
  $$('input[type="radio"]').forEach(r=>r.checked=false);
  const alert = $('#alert');
  if(alert) alert.style.display='none';
}

function renderResult(){
  const summaryEl = $('#summary') || $('#result');
  const recEl = $('#recommendations') || summaryEl;
  if(!summaryEl || !recEl) return;
  let raw = null;
  try { raw = localStorage.getItem('va_postictus'); } catch(e) {}
  if(!raw){
    try { raw = sessionStorage.getItem('va_postictus'); } catch(e) {}
  }
  let data = null;
  if(raw){
    try { data = JSON.parse(raw); } catch(e) { data = null; }
  }
  // Fallback: read answers from URL query (?ans=AB...)
  if(!data){
    try {
      const params = new URLSearchParams(window.location.search);
      const ans = (params.get('ans') || '').trim().toUpperCase();
      if(ans && ans.length >= 12){
        const answers = ans.slice(0,12).split('');
        data = {answers, profile: computeProfile(answers), focus: computeFocus(answers), ts: Date.now()};
        persistPostIctusPayload(data);
      }
    } catch(e) {}
  }
  if(!data){
    summaryEl.innerHTML = `
    <div class="alert" style="display:block">Nessun questionario trovato. Torna alla pagina del quiz.</div>`;
    return;
  }
  const {profile, focus} = data;

  const titleMap = {
    AUTONOMO: "Profilo: Autonomo",
    SUPPORTATO: "Profilo: Supportato",
    ASSISTITO: "Profilo: Assistito"
  };
  const focusMap = {
    MOBILITA: "Focus: Mobilità e prevenzione cadute",
    BAGNO: "Focus: Bagno e WC",
    LETTO: "Focus: Letto e trasferimenti"
  };

  const content = getRecommendationContent(profile, focus);

  summaryEl.innerHTML = `
    <div class="badge"><span class="tag">${titleMap[profile]||profile}</span><span class="tag">${focusMap[focus]||focus}</span></div>
  `;

  recEl.innerHTML = `
    <h2 id="raccomandazioni">Cosa fare adesso (Post-ictus a casa)</h2>
    <p>Tre passi, in ordine. Non serve comprare tutto: fai prima ciò che riduce davvero i rischi.</p>

    ${renderBlock("1) Prima cosa da fare (Prioritaria)", content.prioritaria)}
    ${renderBlock("2) Seconda scelta (Alternativa)", content.alternativa)}
    ${renderBlock("3) Minimo efficace (Budget)", content.budget)}

   
    ${renderAffiliateSection(profile, focus)}
 ${renderRoadmap(content.roadmap)}

    ${renderPhysioQuestions()}

    <div class="block">
      <h3>Quando chiamare un professionista</h3>
      <ul>
        <li>Cadute o quasi-cadute ripetute.</li>
        <li>Trasferimenti che richiedono sforzo eccessivo o ti “bloccano” per paura.</li>
        <li>Dolore importante, affaticamento estremo o peggioramento rapido della stabilità.</li>
      </ul>
    </div>

    <p class="note">Disclaimer: Vivere Assistito fornisce informazioni generali e criteri pratici. Non sostituisce medico, fisioterapista o terapista occupazionale.</p>
  `;

  // If the page was opened with #raccomandazioni, ensure we scroll after dynamic render.
  if(location.hash === '#raccomandazioni'){
    setTimeout(()=>{
      document.getElementById('raccomandazioni')?.scrollIntoView({behavior:'smooth', block:'start'});
    }, 50);
  }
}

function renderBlock(title, b){
  return `
    <div class="block">
      <h3>${title}</h3>
      <p><strong>Obiettivo:</strong> ${b.obiettivo}</p>
      <p><strong>Perché ora:</strong> ${b.perche}</p>
      <p><strong>Dove in casa:</strong> ${b.dove}</p>
      <p><strong>Prima di comprare (30 secondi):</strong></p>
      <ul>${b.prima.map(x=>`<li>${x}</li>`).join('')}</ul>
      <p><strong>Evita questi errori:</strong></p>
      <ul>${b.evita.map(x=>`<li>${x}</li>`).join('')}</ul>
    </div>
  `;
}


function renderAffiliateSection(profile, focus){
  const items = getAffiliateLinks(profile, focus);
  const rows = items.map((it, idx)=>{
    const key = `aff_${focus}_${idx}`;
    const disabled = (it.href === "#" || it.href.trim()==="") ? "aria-disabled='true'" : "";
    const note = (it.href === "#" || it.href.trim()==="") ? "<span class='note'>Link placeholder: inserire URL affiliato</span>" : "<span class='note'>Link affiliato</span>";
    return `
      <div class="block">
        <h3>Consiglio pratico ${idx+1}</h3>
        <p><strong>${it.label}</strong></p>
        <p>${it.why}</p>
        <div class="ctaRow">
          <a class="btn primary" href="${it.href}" ${disabled} data-affkey="${key}" target="_blank" rel="nofollow sponsored noopener">Vedi opzioni</a>
        </div>
        ${note}
      </div>
    `;
  }).join("");
  return `
    <div class="block">
      <h3>Se vuoi acquistare: ${items.length} opzioni “sensate”</h3>
      <p>Queste sono categorie utili per il tuo profilo. I link sono dichiarati come affiliati nella pagina Trasparenza.</p>
    </div>
    ${rows}
  `;
}

function renderRoadmap(r){
  return `
    <div class="block">
      <h3>Priorità in 7 giorni</h3>
      <ul>
        <li><strong>Giorno 1–2:</strong> ${r.g12}</li>
        <li><strong>Giorno 3–5:</strong> ${r.g35}</li>
        <li><strong>Giorno 6–7:</strong> ${r.g67}</li>
      </ul>
    </div>
  `;
}

function renderPhysioQuestions(){
  return `
    <div class="block">
      <h3>3 domande da fare al fisioterapista</h3>
      <ul>
        <li><strong>Trasferimenti (letto–sedia–WC):</strong> “Mi fai vedere, passo per passo, la tecnica più sicura per la nostra situazione? Qual è l’errore più frequente da evitare?”</li>
        <li><strong>Percorso critico in casa:</strong> “Quali 2–3 punti della casa aumentano il rischio di caduta e cosa va cambiato per primo (anche senza comprare nulla)?”</li>
        <li><strong>Ausilio adatto:</strong> “Considerando porte/corridoi e fatica, meglio bastone, rollator o altro? Quale altezza è corretta per WC e letto?”</li>
      </ul>
      <p class="note">Se puoi, porta due misure: <span class="kbd">altezza WC</span>, <span class="kbd">altezza letto</span> e la <span class="kbd">larghezza della porta più stretta</span>.</p>
    </div>
  `;
}

function getRecommendationContent(profile, focus){
  const common = {
    roadmap: {
      g12: "Metti in sicurezza il punto più rischioso (di solito bagno/WC o letto–bagno). Elimina tappeti mobili e cavi. Migliora la luce serale/notturna.",
      g35: "Verifica misure (porta più stretta, corridoio, altezza WC/letto). Applica antiscivolo dove serve e ripeti i percorsi a ritmo lento.",
      g67: "Se resta instabilità o paura, introduci un supporto mirato e rivedi la tecnica dei trasferimenti con il fisioterapista."
    }
  };

  const lib = {
    AUTONOMO: {
      MOBILITA: {
        prioritaria: {
          obiettivo:"Ridurre inciampi e scivolamenti nei passaggi più frequenti.",
          perche:"Il rischio aumenta con stanchezza e distrazioni; spesso basta sistemare percorso e luce per cambiare la giornata.",
          dove:"Percorso letto → bagno, corridoio, ingresso bagno, uscita doccia.",
          prima:[
            "Individua tappeti mobili, cavi, angoli sporgenti e rimuovili o fissali.",
            "Controlla le zone buie la sera/notte e aggiungi una luce notturna.",
            "Valuta soglie e pavimenti scivolosi nei punti di passaggio."
          ],
          evita:[
            "Mettere un tappetino antiscivolo sopra un tappeto che scorre.",
            "Lasciare cavi e ciabatte sul pavimento nelle zone di passaggio."
          ]
        },
        alternativa: {
          obiettivo:"Avere un appoggio leggero dove senti instabilità.",
          perche:"Se l’instabilità è localizzata, un supporto “giusto” nel punto giusto aiuta senza complicare tutto.",
          dove:"Un punto preciso: ingresso bagno o tratto di corridoio critico.",
          prima:[
            "Verifica che il passaggio resti libero (niente mobili stretti).",
            "Scegli un solo punto d’uso e usalo sempre allo stesso modo.",
            "Controlla che non crei intralcio a chi ti assiste."
          ],
          evita:[
            "Aggiungere appoggi “a caso” senza sistemare prima ostacoli e luce.",
            "Affidarsi a soluzioni instabili o provvisorie."
          ]
        },
        budget: {
          obiettivo:"Fare il minimo efficace con spesa contenuta.",
          perche:"Prima di comprare, spesso si guadagna sicurezza togliendo rischi “banali” ma frequenti.",
          dove:"Tutta la casa, con priorità sul percorso letto–bagno.",
          prima:[
            "Togli tappeti mobili e fissa i cavi.",
            "Migliora la luce dove cammini di notte.",
            "Metti antiscivolo in doccia/uscita doccia."
          ],
          evita:[
            "Comprare accessori ‘extra’ prima di aver messo ordine e luce.",
            "Ignorare i punti dove inciampi davvero (di solito sono sempre gli stessi)."
          ]
        }
      },
      BAGNO: {
        prioritaria: {
          obiettivo:"Rendere sicuri WC e uscita doccia (alzarsi/sedersi senza perdere equilibrio).",
          perche:"Il bagno unisce pavimento bagnato e trasferimenti rapidi: è il punto più critico anche per chi è autonomo.",
          dove:"Uscita doccia e fronte WC.",
          prima:[
            "Misura altezza WC e spazio laterale libero.",
            "Verifica se la doccia ha soglia alta o box stretto.",
            "Controlla il tipo di parete se pensi a un appoggio fissato."
          ],
          evita:[
            "Sedute doccia instabili o incompatibili con lo spazio.",
            "Appoggi fissati male o in punti poco utili."
          ]
        },
        alternativa: {
          obiettivo:"Ridurre fatica e instabilità durante la doccia.",
          perche:"Quando ti stanchi, l’equilibrio cala: una seduta può aiutare se compatibile con lo spazio.",
          dove:"Doccia/vasca (se accessibile).",
          prima:[
            "Verifica ingombri e stabilità della seduta.",
            "Controlla che sedersi e rialzarsi sia sicuro.",
            "Assicurati che non intralci apertura/chiusura del box."
          ],
          evita:[
            "Scegliere sedute troppo piccole o scivolose.",
            "Usare la seduta senza un appoggio vicino se ti senti instabile."
          ]
        },
        budget: {
          obiettivo:"Ridurre rischi senza interventi complessi.",
          perche:"Antiscivolo e routine più lenta riducono molti incidenti già da soli.",
          dove:"Doccia/uscita doccia e percorso verso asciugamani.",
          prima:[
            "Metti antiscivolo in doccia e tappeto ad alta aderenza all’uscita.",
            "Tieni asciugamani e oggetti a portata (niente ‘allungamenti’).",
            "Asciuga subito zone bagnate sul pavimento."
          ],
          evita:[
            "Affidarti solo al tappetino senza sistemare appigli e oggetti a portata.",
            "Fretta nei trasferimenti (alzarsi/sedersi)."
          ]
        }
      },
      LETTO: {
        prioritaria: {
          obiettivo:"Rendere sicuro il passaggio letto ↔ in piedi (soprattutto di notte).",
          perche:"Anche con buona autonomia, la notte e la stanchezza aumentano rischi e incertezze.",
          dove:"Zona letto e primo tratto verso bagno.",
          prima:[
            "Verifica altezza letto e facilità di alzata (troppo basso = fatica).",
            "Metti luce notturna e percorso libero verso bagno.",
            "Assicurati che vicino al letto ci sia una seduta stabile per pause."
          ],
          evita:[
            "Camminare al buio o con oggetti sul pavimento.",
            "Sedie leggere che scappano quando ti appoggi."
          ]
        },
        alternativa: {
          obiettivo:"Ridurre lo sforzo nell’alzarsi se hai fatica.",
          perche:"Se l’alzata è faticosa, aumentano movimenti bruschi e perdita di equilibrio.",
          dove:"Solo zona letto.",
          prima:[
            "Valuta se la seduta/letto è alla giusta altezza per te.",
            "Prova alzata lenta in 3 step (seduto–in avanti–in piedi).",
            "Tieni vicino un punto d’appoggio stabile (non mobile)."
          ],
          evita:[
            "Appoggiarsi a comodini leggeri o instabili.",
            "Alzarsi di scatto quando sei affaticato."
          ]
        },
        budget: {
          obiettivo:"Semplificare e mettere ordine attorno al letto.",
          perche:"Molte cadute notturne dipendono da disordine, luce e percorsi stretti.",
          dove:"Camera e corridoio verso bagno.",
          prima:[
            "Sgombera il lato del letto usato per alzarsi.",
            "Aggiungi luce notturna e libera il percorso.",
            "Metti un tappeto ad alta aderenza dove appoggi i piedi (se necessario)."
          ],
          evita:[
            "Lasciare vestiti/scarpe sul percorso.",
            "Usare tappeti che scivolano."
          ]
        }
      }
    },
    SUPPORTATO: {
      MOBILITA: {
        prioritaria: {
          obiettivo:"Camminare con meno sforzo e meno rischio usando un supporto compatibile con casa.",
          perche:"Hai indicato instabilità e/o quasi-cadute: serve un aiuto costante, non ‘a momenti’.",
          dove:"Corridoio, zona letto, ingresso bagno.",
          prima:[
            "Misura la porta più stretta e il corridoio più stretto.",
            "Controlla soglie e tappeti che possono bloccare ruote o far inciampare.",
            "Decidi se lo userai anche in bagno (spesso non entra: serve piano B)."
          ],
          evita:[
            "Scegliere un ausilio troppo largo per casa.",
            "Ignorare soglie e tappeti che fanno impigliare o sbilanciare."
          ]
        },
        alternativa: {
          obiettivo:"Avere ‘stazioni di sosta’ invece di un ausilio sempre.",
          perche:"Se gli spazi sono stretti, 2–3 punti sicuri possono ridurre fatica e rischio.",
          dove:"Metà corridoio, vicino al bagno, vicino al letto.",
          prima:[
            "Posiziona una seduta stabile dove ti fermi davvero.",
            "Assicurati che il passaggio resti libero e ordinato.",
            "Verifica che la seduta non scivoli quando ti appoggi."
          ],
          evita:[
            "Sedie leggere o con ruote non bloccabili.",
            "Creare ostacoli con mobili aggiunti ‘di fretta’."
          ]
        },
        budget: {
          obiettivo:"Ridurre rischi senza acquisti importanti.",
          perche:"Prima si eliminano le cause di inciampo e si crea una routine di soste.",
          dove:"Percorso letto–bagno e corridoi.",
          prima:[
            "Togli tappeti scorrevoli e fissa i cavi.",
            "Crea una seduta stabile a metà percorso se ti affatichi.",
            "Migliora la luce serale/notturna nei passaggi."
          ],
          evita:[
            "Pensare che basti ‘stare più attenti’ senza cambiare la casa.",
            "Rimandare i punti critici (bagno e soglie)."
          ]
        }
      },
      BAGNO: {
        prioritaria: {
          obiettivo:"Rendere il WC sicuro prima di tutto (alzarsi/sedersi con stabilità).",
          perche:"È il gesto più ripetuto e spesso causa cadute; qui si vince o si perde sicurezza.",
          dove:"WC e zona lavandino (appoggio).",
          prima:[
            "Misura altezza WC e spazio laterale.",
            "Valuta se serve stabilità laterale (braccioli) in base alla tua instabilità.",
            "Controlla pavimento e uscita doccia: sono punti scivolosi."
          ],
          evita:[
            "Rialzi instabili o non adatti al peso.",
            "Appoggi fissati su pareti non idonee."
          ]
        },
        alternativa: {
          obiettivo:"Ridurre fatica e rischio in doccia (se è il secondo punto critico).",
          perche:"Se la doccia è difficile, la stanchezza aumenta e cala l’equilibrio.",
          dove:"Doccia/vasca (se accessibile).",
          prima:[
            "Verifica spazio utile e soglie d’ingresso.",
            "Controlla stabilità della seduta e possibilità di alzata sicura.",
            "Assicurati che ci sia un appoggio vicino (senza intralcia)."
          ],
          evita:[
            "Sedute che scivolano o si muovono su piastrelle bagnate.",
            "Soluzioni non compatibili con box doccia stretto."
          ]
        },
        budget: {
          obiettivo:"Ridurre rischi in bagno spendendo poco.",
          perche:"Organizzazione e antiscivolo riducono gli incidenti subito.",
          dove:"Uscita doccia e zona WC.",
          prima:[
            "Antiscivolo in doccia + tappeto ad alta aderenza all’uscita.",
            "Oggetti a portata (asciugamani, saponi) per evitare allungamenti.",
            "Asciugatura rapida del pavimento dopo la doccia."
          ],
          evita:[
            "Lasciare tutto ‘in alto’ o lontano (ti sbilanci).",
            "Fretta nei trasferimenti."
          ]
        }
      },
      LETTO: {
        prioritaria: {
          obiettivo:"Facilitare l’alzata dal letto e rendere sicuro il primo trasferimento del mattino/notte.",
          perche:"Hai indicato fatica o insicurezza: il letto è un punto di partenza critico.",
          dove:"Zona letto + primo tratto verso bagno.",
          prima:[
            "Misura altezza letto: se troppo basso, l’alzata diventa pericolosa.",
            "Metti una seduta stabile vicino al letto per pause.",
            "Illumina il percorso verso bagno (luce notturna)."
          ],
          evita:[
            "Appoggiarsi a comodini instabili.",
            "Alzarsi di scatto quando sei affaticato."
          ]
        },
        alternativa: {
          obiettivo:"Ridurre il rischio di movimenti insicuri nel letto (se serve).",
          perche:"Se ti muovi con fatica, anche girarti può diventare rischioso.",
          dove:"Solo letto e lato di uscita.",
          prima:[
            "Controlla spazio attorno al lato di uscita dal letto.",
            "Tieni a portata ciò che serve (acqua, telefono).",
            "Verifica che non ci siano tappeti scivolosi ai piedi del letto."
          ],
          evita:[
            "Oggetti sul pavimento accanto al letto.",
            "Percorso stretto verso bagno."
          ]
        },
        budget: {
          obiettivo:"Ordine, luce, appoggi ‘giusti’ prima di tutto.",
          perche:"Riduce rischi senza acquisti complessi.",
          dove:"Camera e corridoio.",
          prima:[
            "Sgombera il lato di uscita dal letto.",
            "Metti luce notturna e libera il percorso.",
            "Crea una seduta stabile per pause."
          ],
          evita:[
            "Tappeti che scivolano.",
            "Camminare al buio."
          ]
        }
      }
    },
    ASSISTITO: {
      MOBILITA: {
        prioritaria: {
          obiettivo:"Ridurre rischi nei trasferimenti assistiti e nei passaggi più frequenti.",
          perche:"Con assistenza e instabilità, i trasferimenti sono il rischio n.1 per la persona e per il caregiver.",
          dove:"Letto ↔ sedia, sedia ↔ WC, percorso verso bagno.",
          prima:[
            "Sgombera l’area di trasferimento (spazio per caregiver).",
            "Assicurati che la seduta usata sia stabile e non scivoli.",
            "Controlla pavimento e soglie sul percorso."
          ],
          evita:[
            "Improvvisare con sedie leggere che scappano.",
            "Trasferimenti ‘di fretta’ senza posizionare bene seduta e piedi."
          ]
        },
        alternativa: {
          obiettivo:"Mettere in sicurezza prima i bisogni più frequenti (WC), poi il resto.",
          perche:"Se il bagno domina la giornata, partire dal WC riduce subito rischio e stress.",
          dove:"WC e percorso letto–bagno.",
          prima:[
            "Verifica spazio laterale per caregiver vicino al WC.",
            "Controlla altezza seduta e stabilità.",
            "Organizza oggetti a portata per ridurre movimenti inutili."
          ],
          evita:[
            "Soluzioni ingombranti che non lasciano spazio al caregiver.",
            "Oggetti lontani che costringono a spostamenti rischiosi."
          ]
        },
        budget: {
          obiettivo:"Ridurre rischi oggi, senza comprare ‘tutto’.",
          perche:"Ordine, luce e procedura riducono incidenti immediatamente.",
          dove:"Camera, corridoio, bagno.",
          prima:[
            "Sgombera percorso e area letto.",
            "Aggiungi luce notturna e antiscivolo nei punti bagnati.",
            "Introduci un modo semplice di chiamata/avviso se resta solo anche pochi minuti."
          ],
          evita:[
            "Lasciare ostacoli sul percorso.",
            "Sottovalutare la notte (buio + urgenza)."
          ]
        }
      },
      BAGNO: {
        prioritaria: {
          obiettivo:"WC e trasferimenti: stabilità e spazio caregiver.",
          perche:"È il punto più ripetuto e più pericoloso: se lo metti in sicurezza, abbassi il rischio globale.",
          dove:"WC e punto d’appoggio vicino.",
          prima:[
            "Verifica spazio laterale per caregiver.",
            "Controlla altezza seduta e stabilità laterale.",
            "Valuta pareti idonee se pensi a fissaggi (altrimenti soluzioni alternative)."
          ],
          evita:[
            "Prodotti senza stabilità laterale.",
            "Fissaggi su pareti non idonee."
          ]
        },
        alternativa: {
          obiettivo:"Doccia ‘assistita’ solo se realmente fattibile in sicurezza.",
          perche:"Doccia stretta o con soglia alta aumenta rischio per entrambi.",
          dove:"Doccia/vasca (solo se accessibile).",
          prima:[
            "Misura spazio utile e soglia d’ingresso.",
            "Valuta stabilità della seduta e supporti disponibili.",
            "Organizza tutto a portata per evitare allungamenti."
          ],
          evita:[
            "Forzare la doccia in spazi inadatti.",
            "Soluzioni improvvisate su superfici bagnate."
          ]
        },
        budget: {
          obiettivo:"Ridurre rischi in bagno senza complicare.",
          perche:"Antiscivolo + organizzazione riducono incidenti subito.",
          dove:"Uscita doccia e zona WC.",
          prima:[
            "Antiscivolo e tappeto ad alta aderenza all’uscita.",
            "Asciugatura rapida del pavimento.",
            "Oggetti a portata e percorso libero."
          ],
          evita:[
            "Lasciare pavimento bagnato.",
            "Oggetti lontani che costringono a spostamenti."
          ]
        }
      },
      LETTO: {
        prioritaria: {
          obiettivo:"Rendere sicuro il trasferimento letto ↔ sedia (e ridurre sforzo caregiver).",
          perche:"È il passaggio più rischioso e più frequente: qui si crea la stabilità quotidiana.",
          dove:"Camera e area attorno al letto.",
          prima:[
            "Misura altezza letto e spazio attorno (serve spazio per caregiver).",
            "Usa una seduta stabile e posizionata sempre nello stesso modo.",
            "Metti luce notturna e libera il percorso verso bagno."
          ],
          evita:[
            "Usare sedie instabili o che scappano.",
            "Lasciare ostacoli vicino al letto."
          ]
        },
        alternativa: {
          obiettivo:"Mettere prima in sicurezza il WC se è il bisogno più frequente.",
          perche:"Se le alzate notturne sono frequenti, il WC diventa prioritario.",
          dove:"WC e percorso camera–bagno.",
          prima:[
            "Spazio caregiver vicino al WC.",
            "Stabilità seduta e appoggi.",
            "Oggetti a portata (carta, igiene, luce)."
          ],
          evita:[
            "Percorsi stretti e bui.",
            "Fretta e mancanza di routine."
          ]
        },
        budget: {
          obiettivo:"Procedura + ordine + luce prima di acquistare altro.",
          perche:"Riduce incidenti subito e rende più facile l’assistenza.",
          dove:"Camera e corridoio verso bagno.",
          prima:[
            "Sgombera area attorno al letto.",
            "Aggiungi luce notturna e percorso libero.",
            "Prepara una seduta stabile per pause e assistenza."
          ],
          evita:[
            "Disordine vicino al letto.",
            "Camminare al buio."
          ]
        }
      }
    }
  };

  const content = lib[profile]?.[focus] || lib.SUPPORTATO.BAGNO;
  return {...content, roadmap: common.roadmap};
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(typeof applyAffiliateLinks === 'function') applyAffiliateLinks();

  if($('#quizForm')){
    // Handle native submit (e.g., Enter key) predictably.
    $('#quizForm')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const answers = collectQuizAnswers();
      if(!answers) return;
      const payload = {answers, profile: computeProfile(answers), focus: computeFocus(answers), ts: Date.now()};
      persistPostIctusPayload(payload);
      navigateToResults(answers);
    });
    $('#startBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); document.getElementById('quiz').scrollIntoView({behavior:'smooth'}); });
    // If submit is an <a>, allow default navigation only when validation succeeds.
    $('#submitQuiz')?.addEventListener('click', (e)=>{
      e.preventDefault();
      const answers = collectQuizAnswers();
      if(!answers) return;
      const payload = {answers, profile: computeProfile(answers), focus: computeFocus(answers), ts: Date.now()};
      persistPostIctusPayload(payload);
      navigateToResults(answers);
    });
    $('#resetQuiz')?.addEventListener('click', (e)=>{ e.preventDefault(); clearQuiz(); });
  }
  if($('#summary') || $('#result') || $('#recommendations')){
    renderResult();
    // Track affiliate button clicks (local only)
    document.addEventListener('click', (ev)=>{
      const a = ev.target.closest('a[data-affkey]');
      if(!a) return;
      const k = a.getAttribute('data-affkey');
      trackClick(k);

      // Navigation: open external affiliate links in a new tab; keep internal links in-page
      const href = (a.getAttribute('href')||'').trim();
      if(href && href !== '#'){
        const isExternal = /^https?:\/\//i.test(href);
        if(isExternal){
          ev.preventDefault();
          window.open(href, '_blank', 'noopener');
        }
        // internal: default navigation
      }
    });
  }
});
