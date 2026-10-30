/* ============================================================
   plan.js — Control de acceso por plan (Príncipe / Rey)
   Journal del Rey · Trading Pro Lab
   ------------------------------------------------------------
   Regla: quien NO tenga campo "plan" en su documento de usuario
   cuenta como REY (acceso completo). Solo "principe" tiene límites.
   ============================================================ */
(function () {

  // ▼▼ CONFIGURACIÓN — edita aquí para cambiar qué ve un Príncipe ▼▼

  // Pestañas del dashboard bloqueadas para Príncipes.
  // (Para abrir una, quítala de la lista. Ej: dejar 'meses' libre.)
  var TABS_BLOQUEADAS = ['metricas', 'graficas', 'meses', 'fondeo'];

  // Páginas completas bloqueadas para Príncipes.
  var PAGINAS_BLOQUEADAS = ['escalador.html', 'racha.html'];

  var MENSAJE_CANDADO = '🔒 Disponible para Reyes';

  // ▲▲ FIN DE CONFIGURACIÓN ▲▲

  var cssInyectado = false;

  function inyectarCss() {
    if (cssInyectado) return;
    cssInyectado = true;
    var reglas = [
      '.nav-locked{opacity:.45;cursor:not-allowed;}',
      '.nav-locked::after{content:"🔒";margin-left:auto;font-size:.72rem;}',
      '.dash-tab.tab-locked{opacity:.5;}',
      'body.plan-principe #fondeoTab{display:none !important;}',
      'body.plan-principe #ahRachaBadge{display:none !important;}'
    ];
    TABS_BLOQUEADAS.forEach(function (t) {
      reglas.push('body.plan-principe #tab-' + t + '{display:none !important;}');
    });
    var style = document.createElement('style');
    style.textContent = reglas.join('\n');
    document.head.appendChild(style);
  }

  function avisar(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg, 'info');
  }

  function bloquearMenu() {
    PAGINAS_BLOQUEADAS.forEach(function (pagina) {
      var enlaces = document.querySelectorAll('a.nav-item[href="' + pagina + '"]');
      enlaces.forEach(function (a) {
        a.setAttribute('href', '#');
        a.classList.add('nav-locked');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          avisar(MENSAJE_CANDADO);
        });
      });
    });
  }

  function bloquearTabsDashboard() {
    document.querySelectorAll('.dash-tab').forEach(function (btn) {
      var m = (btn.getAttribute('onclick') || '').match(/showTab\('(\w+)'\)/);
      if (m && TABS_BLOQUEADAS.indexOf(m[1]) > -1) {
        btn.classList.add('tab-locked');
        if (btn.textContent.indexOf('🔒') === -1) {
          btn.textContent = '🔒 ' + btn.textContent.trim();
        }
      }
    });

    // Envolver showTab para que las pestañas bloqueadas no se abran
    if (typeof window.showTab === 'function' && !window.showTab._tplWrapped) {
      var original = window.showTab;
      var envuelta = function (tab) {
        if (TABS_BLOQUEADAS.indexOf(tab) > -1) {
          avisar(MENSAJE_CANDADO);
          return;
        }
        return original.apply(this, arguments);
      };
      envuelta._tplWrapped = true;
      window.showTab = envuelta;
    }
  }

  var TPLPlan = {
    plan: 'rey',

    normalize: function (p) {
      return p === 'principe' ? 'principe' : 'rey';
    },

    isPrincipe: function () {
      return TPLPlan.plan === 'principe';
    },

    // Llamar justo después de leer el documento del usuario
    apply: function (planCrudo) {
      TPLPlan.plan = TPLPlan.normalize(planCrudo);
      window._plan = TPLPlan.plan;
      if (!TPLPlan.isPrincipe()) return;
      inyectarCss();
      document.body.classList.add('plan-principe');
      bloquearMenu();
      bloquearTabsDashboard();
    },

    // Reemplaza el contenido de la página por una pantalla de candado
    lockPage: function (titulo) {
      var main = document.querySelector('main.main-content');
      if (!main) return;
      main.innerHTML =
        '<div style="text-align:center;padding:70px 20px;max-width:460px;margin:0 auto">' +
          '<div style="font-size:3rem;margin-bottom:14px">🔒</div>' +
          '<h2 style="margin-bottom:8px">' + titulo + '</h2>' +
          '<p style="margin-bottom:22px">Esta herramienta es exclusiva para los Reyes. ' +
          'Tu plan de Príncipe incluye tu journal, tus operaciones y tus estadísticas básicas.</p>' +
          '<a class="btn btn-primary" href="cuentas.html">Volver a mis cuentas</a>' +
        '</div>';
    }
  };

  window.TPLPlan = TPLPlan;
})();
