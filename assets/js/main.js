/* ==========================================================================
   Landing page — comportamento e medição
   Sem dependências. Tudo aqui existe por uma razão de funil:
   atribuição que sobrevive até o WhatsApp, eventos de conversão e consentimento.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     Configuração — o que a Mariela/o gestor de tráfego preenche
     ---------------------------------------------------------------------- */
  var CONFIG = {
    whatsapp: '5527981385109',            // Mariela Celestino — WhatsApp de atendimento
    baseMessage: 'Olá! Tive um problema com meu voo e gostaria de entender meus direitos.',
    contextMessages: {                     // mensagem por situação escolhida no hero
      atraso:     'Olá! Meu voo atrasou e gostaria de entender meus direitos.',
      cancelado:  'Olá! Meu voo foi cancelado e gostaria de entender meus direitos.',
      preterido:  'Olá! Tive o embarque negado (overbooking) e gostaria de entender meus direitos.',
      bagagem:    'Olá! Tive problema com a minha bagagem e gostaria de entender meus direitos.'
    },

    /* Identificadores de medição. Vazio = tag não sobe, e a página segue
       funcionando e empilhando eventos no dataLayer. Preencher aqui, e só aqui. */
    ga4:      '',                          // G-XXXXXXXXXX      — GA4
    googleAds: '',                         // AW-XXXXXXXXX      — Google Ads
    adsConversao: '',                      // AW-XXXXXXXXX/abcD — rótulo da conversão whatsapp_click
    metaPixel: ''                          // 123456789012345   — Meta Pixel
  };

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ----------------------------------------------------------------------
     1. Camada de eventos
     Tudo passa por track(): enquanto GA4/Pixel não estiverem instalados, os
     eventos ficam no dataLayer e no console — nada se perde e nada quebra.
     ---------------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];

  function track(name, params) {
    var payload = params || {};
    window.dataLayer.push(Object.assign({ event: name }, payload));
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
      // a conversão única otimizada no Google Ads
      if (name === 'whatsapp_click' && CONFIG.adsConversao) {
        window.gtag('event', 'conversion', { send_to: CONFIG.adsConversao });
      }
    }
    if (typeof window.fbq === 'function') {
      // Contact é o evento padrão do Meta para início de conversa
      if (name === 'whatsapp_click') window.fbq('track', 'Contact', payload);
      else window.fbq('trackCustom', name, payload);
    }
    if (window.__DEBUG_TRACKING__) console.log('[track]', name, payload);
  }
  window.track = track;

  /* ----------------------------------------------------------------------
     2. Atribuição que atravessa o funil
     O clique termina no WhatsApp, fora de qualquer analytics. Então a origem
     do anúncio viaja dentro da própria mensagem: a Mariela lê, na primeira
     linha, de qual campanha veio aquele lead.
     ---------------------------------------------------------------------- */
  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];

  function readAttribution() {
    var qs = new URLSearchParams(window.location.search);
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('attr') || '{}'); } catch (e) { stored = {}; }
    ATTR_KEYS.forEach(function (k) { if (qs.get(k)) stored[k] = qs.get(k); });
    try { sessionStorage.setItem('attr', JSON.stringify(stored)); } catch (e) {}
    return stored;
  }
  var ATTR = readAttribution();

  function attributionTag() {
    var src = ATTR.utm_source || (ATTR.gclid ? 'google' : (ATTR.fbclid ? 'meta' : ''));
    var camp = ATTR.utm_campaign || '';
    if (!src && !camp) return '';
    return '\n\n[ref: ' + [src, camp, ATTR.utm_content].filter(Boolean).join(' / ') + ']';
  }

  function whatsappURL(message) {
    return 'https://wa.me/' + CONFIG.whatsapp +
           '?text=' + encodeURIComponent((message || CONFIG.baseMessage) + attributionTag());
  }

  /* ----------------------------------------------------------------------
     3. Todos os caminhos para o WhatsApp
     ---------------------------------------------------------------------- */
  function goToWhatsApp(message, position, context) {
    track('whatsapp_click', {
      cta_position: position || 'desconhecida',
      situacao: context || 'nao_informada',
      utm_source: ATTR.utm_source || '',
      utm_campaign: ATTR.utm_campaign || ''
    });
    window.open(whatsappURL(message), '_blank', 'noopener');
  }

  $$('[data-wa]').forEach(function (el) {
    el.setAttribute('href', whatsappURL(CONFIG.baseMessage));
    el.addEventListener('click', function (e) {
      e.preventDefault();
      goToWhatsApp(CONFIG.baseMessage, el.getAttribute('data-wa'));
    });
  });

  // Atalhos de situação no hero: qualificam o lead antes da primeira palavra
  $$('[data-situacao]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-situacao');
      track('situacao_selecionada', { situacao: key });
      goToWhatsApp(CONFIG.contextMessages[key] || CONFIG.baseMessage, 'hero_situacao', key);
    });
  });

  /* ----------------------------------------------------------------------
     4. Cabeçalho fixo e barra de ação no celular
     ---------------------------------------------------------------------- */
  var header = $('.site-header');
  var mobileCta = $('.mobile-cta');
  var hero = $('.hero');

  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-stuck', y > 8);
    if (mobileCta && hero) {
      mobileCta.classList.toggle('is-visible', y > hero.offsetHeight * 0.6);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------------------
     5. Profundidade de leitura — diz onde a página perde a pessoa
     ---------------------------------------------------------------------- */
  var marks = [25, 50, 75, 90];
  var fired = {};
  window.addEventListener('scroll', function () {
    var doc = document.documentElement;
    var pct = (window.scrollY + window.innerHeight) / doc.scrollHeight * 100;
    marks.forEach(function (m) {
      if (pct >= m && !fired[m]) { fired[m] = true; track('scroll_depth', { percent: m }); }
    });
  }, { passive: true });

  /* ----------------------------------------------------------------------
     6. Checklist de documentos — engajamento e pré-triagem
     ---------------------------------------------------------------------- */
  var checks = $$('.check input');
  var counter = $('#docs-count');
  var counted = false;
  checks.forEach(function (input) {
    input.addEventListener('change', function () {
      var n = checks.filter(function (i) { return i.checked; }).length;
      if (counter) counter.textContent = String(n);
      if (!counted) { counted = true; track('checklist_engajada', {}); }
      track('documento_marcado', { documento: input.value, total_marcado: n });
    });
  });

  /* ----------------------------------------------------------------------
     7. FAQ — cada abertura é uma objeção declarada
     ---------------------------------------------------------------------- */
  $$('.faq details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) track('faq_aberta', { pergunta: d.getAttribute('data-q') || '' });
    });
  });

  /* ----------------------------------------------------------------------
     8. Revelação ao rolar
     ---------------------------------------------------------------------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ----------------------------------------------------------------------
     9. Consentimento (LGPD)
     Os scripts de medição só sobem depois do aceite. Enquanto não há aceite,
     a página funciona inteira — só não mede.
     ---------------------------------------------------------------------- */
  var consent = $('.consent');
  var STORE_KEY = 'consent-analytics';

  function carregaScript(src) {
    var s = document.createElement('script');
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  function loadTrackers() {
    // gtag serve GA4 e Google Ads pela mesma biblioteca
    var gtagId = CONFIG.ga4 || CONFIG.googleAds;
    if (gtagId) {
      carregaScript('https://www.googletagmanager.com/gtag/js?id=' + gtagId);
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      if (CONFIG.ga4)       window.gtag('config', CONFIG.ga4);
      if (CONFIG.googleAds) window.gtag('config', CONFIG.googleAds);
    }

    if (CONFIG.metaPixel) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', CONFIG.metaPixel);
      window.fbq('track', 'PageView');
    }

    track('consentimento_aceito', {});
  }

  var saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}

  if (saved === 'aceito') {
    loadTrackers();
  } else if (saved !== 'recusado' && consent) {
    setTimeout(function () { consent.classList.add('is-visible'); }, 1200);
    $('[data-consent="aceitar"]').addEventListener('click', function () {
      try { localStorage.setItem(STORE_KEY, 'aceito'); } catch (e) {}
      consent.classList.remove('is-visible');
      loadTrackers();
    });
    $('[data-consent="recusar"]').addEventListener('click', function () {
      try { localStorage.setItem(STORE_KEY, 'recusado'); } catch (e) {}
      consent.classList.remove('is-visible');
    });
  }

  /* ----------------------------------------------------------------------
     10. Chegada
     ---------------------------------------------------------------------- */
  track('pagina_carregada', {
    utm_source: ATTR.utm_source || 'direto',
    utm_campaign: ATTR.utm_campaign || ''
  });
})();
