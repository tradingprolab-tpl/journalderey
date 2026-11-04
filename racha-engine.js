/* ============================================================
   racha-engine.js — Motor de validación de la Racha TPL
   Journal del Rey · Trading Pro Lab
   ------------------------------------------------------------
   Compara cada operación del Journal con las reglas del plan de
   la racha activa y decide: válida / inválida / pendiente.

   - Válida    → suma +1 a la racha.
   - Inválida  → hay una infracción CRÍTICA: la racha se rompe.
   - Pendiente → faltan datos o hay que confirmar a mano.

   Margen de error del 10 % en reglas numéricas:
   - Máximos (riesgo, pérdidas, trades, drawdown): infracción si valor > límite × 1.10
   - Mínimos (RR):                                   infracción si valor < límite × 0.90
   - Reglas sí/no (horario, día, activo, FOMO...):   sin margen.

   Es idempotente: cada trade se evalúa una sola vez (el documento de
   evaluación usa como ID el ID del trade). Las evaluaciones no se
   reclasifican retroactivamente.
   ============================================================ */
(function () {
  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MARGEN = 0.10;

  // ── Utilidades ──────────────────────────────────────────────
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? NaN : n; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function minutos(hhmm) {
    var p = String(hhmm || '').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  function fechaInicioISO(racha) {
    var f = racha.fechaInicio;
    var d = f && typeof f.toDate === 'function' ? f.toDate() : (f instanceof Date ? f : new Date());
    return isoDate(d);
  }
  function weekKey(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    var dayNum = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayNum + 3);
    var firstThursday = new Date(d.getFullYear(), 0, 4);
    var diff = (d - firstThursday) / 86400000;
    var week = 1 + Math.round((diff - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + '-W' + week;
  }
  function orden(a, b) {
    var ka = (a.date || '') + ' ' + (a.time || '00:00');
    var kb = (b.date || '') + ' ' + (b.time || '00:00');
    if (ka !== kb) return ka < kb ? -1 : 1;
    var ta = (a.timestamp && a.timestamp.seconds) || 0;
    var tb = (b.timestamp && b.timestamp.seconds) || 0;
    return ta - tb;
  }
  function dentroDeHorario(hora, ini, fin) {
    var h = minutos(hora), a = minutos(ini), b = minutos(fin);
    return a <= b ? (h >= a && h <= b) : (h >= a || h <= b); // soporta horarios que cruzan medianoche
  }
  function coincideSetup(valor, setup) {
    var a = norm(valor), b = norm(setup);
    if (a.length < 2 || b.length < 2) return false;
    return a.indexOf(b) > -1 || b.indexOf(a) > -1;
  }

  // ── Evaluación de UN trade ──────────────────────────────────
  // all: todos los trades de la cuenta (ya ordenados cronológicamente)
  function evaluateTrade(t, all, plan, size, inicio) {
    var infr = [];
    function reg(v) { return (v === undefined || v === null || v === '') ? '—' : v; }
    function add(cat, regla, desc, val, perm, conMargen) {
      infr.push({
        regla: regla, categoria: cat, descripcion: desc,
        valorRegistrado: reg(val), valorPermitido: reg(perm), margenAplicado: !!conMargen
      });
    }
    function crit(regla, desc, val, perm) { add('critica', regla, desc, val, perm, false); }
    function rev(regla, desc, val, perm) { add('revision', regla, desc, val, perm, false); }
    function margen(regla, desc, val, perm) { add('margen', regla, desc, val, perm, true); }

    // Máximo con margen: devuelve 'critica' | 'margen' | null
    function superaMaximo(valor, limite) {
      if (valor > limite * (1 + MARGEN)) return 'critica';
      if (valor > limite) return 'margen';
      return null;
    }

    var dia = all.filter(function (x) { return x.date === t.date; });
    var pos = dia.findIndex(function (x) { return x.id === t.id; });
    if (pos < 0) pos = dia.length - 1;

    // Suma de PnL de los trades que cumplen el filtro, hasta este trade (inclusive)
    function acumulado(filtro) {
      var s = 0;
      for (var i = 0; i < all.length; i++) {
        var x = all[i];
        if (x.date && filtro(x)) s += num(x.pnlUsd) || 0;
        if (x.id === t.id) break;
      }
      return s;
    }

    // 1) Instrumentos autorizados (sí/no)
    if (plan.instrumentos && plan.instrumentos.length) {
      if (!t.asset) {
        rev('Instrumento', 'El trade no tiene activo registrado.', null, plan.instrumentos.join(', '));
      } else if (!plan.instrumentos.some(function (i) { return norm(i) === norm(t.asset); })) {
        crit('Instrumento no autorizado', 'Operaste un activo que no está en tu plan.', t.asset, plan.instrumentos.join(', '));
      }
    }

    // 2) Días habilitados (sí/no)
    if (plan.diasHabilitados && plan.diasHabilitados.length && t.date) {
      var nombreDia = DIAS[new Date(t.date + 'T12:00:00').getDay()];
      if (plan.diasHabilitados.indexOf(nombreDia) === -1) {
        crit('Día no habilitado', 'Operaste un día que tu plan no permite.', nombreDia, plan.diasHabilitados.join(', '));
      }
    }

    // 3) Horario autorizado (sí/no)
    if (plan.horarioInicio && plan.horarioFin) {
      if (!t.time) {
        rev('Horario', 'El trade no tiene hora registrada.', null, plan.horarioInicio + ' – ' + plan.horarioFin);
      } else if (!dentroDeHorario(t.time, plan.horarioInicio, plan.horarioFin)) {
        crit('Fuera de horario', 'Operaste fuera del horario autorizado.', t.time, plan.horarioInicio + ' – ' + plan.horarioFin);
      }
    }

    // 4) Máximo de operaciones por día
    if (plan.maxTradesDay) {
      var nTrade = pos + 1;
      var r4 = superaMaximo(nTrade, plan.maxTradesDay);
      if (r4 === 'critica') crit('Exceso de operaciones', 'Superaste el máximo de operaciones del día.', nTrade + 'ª operación', 'máx. ' + plan.maxTradesDay);
      else if (r4 === 'margen') margen('Exceso de operaciones', 'Dentro del margen de tolerancia del 10 %.', nTrade + 'ª operación', 'máx. ' + plan.maxTradesDay);
    }

    // 5) Riesgo por operación (% y $)
    if (plan.riesgoMaxPct || plan.riesgoMaxUsd) {
      var riesgo = num(t.risk);
      if (isNaN(riesgo)) {
        rev('Riesgo', 'El trade no tiene el riesgo aplicado registrado.', null,
          (plan.riesgoMaxPct ? plan.riesgoMaxPct + '%' : '') + (plan.riesgoMaxUsd ? ' / $' + plan.riesgoMaxUsd : ''));
      } else {
        if (plan.riesgoMaxPct) {
          var r5 = superaMaximo(riesgo, plan.riesgoMaxPct);
          if (r5 === 'critica') crit('Exceso de riesgo', 'Arriesgaste más que tu máximo por trade.', riesgo + '%', 'máx. ' + plan.riesgoMaxPct + '%');
          else if (r5 === 'margen') margen('Riesgo', 'Dentro del margen de tolerancia del 10 %.', riesgo + '%', 'máx. ' + plan.riesgoMaxPct + '%');
        }
        if (plan.riesgoMaxUsd && size > 0) {
          var riesgoUsd = size * riesgo / 100;
          var r5b = superaMaximo(riesgoUsd, plan.riesgoMaxUsd);
          var txt = '$' + riesgoUsd.toFixed(2);
          if (r5b === 'critica') crit('Exceso de riesgo ($)', 'Arriesgaste más dinero que tu máximo por trade.', txt, 'máx. $' + plan.riesgoMaxUsd);
          else if (r5b === 'margen') margen('Riesgo ($)', 'Dentro del margen de tolerancia del 10 %.', txt, 'máx. $' + plan.riesgoMaxUsd);
        }
      }
    }

    // 6) RR mínimo (solo trades ganadores: en una pérdida el RR obtenido no aplica)
    if (t.result === 'win') {
      var rr = num(t.rr);
      if (plan.rrMin) {
        if (isNaN(rr)) {
          rev('RR', 'El trade ganador no tiene el RR registrado.', null, 'mín. 1:' + plan.rrMin);
        } else if (rr < plan.rrMin * (1 - MARGEN)) {
          crit('RR por debajo del mínimo', 'Cerraste con un RR menor al mínimo de tu plan.', '1:' + rr, 'mín. 1:' + plan.rrMin);
        } else if (rr < plan.rrMin) {
          margen('RR', 'Dentro del margen de tolerancia del 10 %.', '1:' + rr, 'mín. 1:' + plan.rrMin);
        }
      }
      if (plan.rrMax && !isNaN(rr) && rr > plan.rrMax * (1 + MARGEN)) {
        rev('RR por encima del máximo', 'Tu RR supera el máximo definido en el plan; confirma si fue parte del método.', '1:' + rr, 'máx. 1:' + plan.rrMax);
      }
    }

    // 7) Impulsividad declarada por el trader (sí/no)
    if (plan.prohibirRevenge) {
      if (t.fomo === 'Si') crit('Operación por FOMO', 'Marcaste que sentiste FOMO y tu plan lo prohíbe.', 'FOMO: Sí', 'prohibido');
      if (t.revenge === 'Si') crit('Operación por venganza', 'Marcaste que fue una operación de revancha y tu plan lo prohíbe.', 'Revancha: Sí', 'prohibido');
    }

    // 8) Declaraciones manuales del trader
    if (t.followedPlan === 'No') crit('Fuera del plan', 'Marcaste que NO seguiste el plan en esta operación.', 'Seguiste el plan: No', 'Sí');
    if (t.validSetup === 'No') crit('Setup no válido', 'Marcaste que el setup NO era válido.', 'Setup válido: No', 'Sí');
    if (plan.checklistObligatorio && (!t.followedPlan || !t.validSetup)) {
      rev('Checklist incompleto', 'Faltan "¿Seguiste el plan?" o "¿Setup válido?" en el trade.', null, 'obligatorio');
    }

    // 9) Noticias
    if (plan.operarNoticias === false) {
      if (t.hasNews === 'Si') crit('Operaste en noticia', 'Tu plan prohíbe operar con noticias importantes.', 'Noticia: Sí', 'prohibido');
      else if (!t.hasNews) rev('Noticias', 'No indicaste si había noticia importante.', null, 'obligatorio');
    }

    // 10) Estado emocional obligatorio
    if (plan.emocionObligatoria && (!t.emotionBefore || !t.emotionAfter)) {
      rev('Estado emocional', 'Falta el estado emocional antes o después de operar.', null, 'obligatorio');
    }

    // 11) Setups permitidos (texto libre → si no coincide, se pide confirmación manual)
    if (plan.setups && plan.setups.length) {
      var candidatos = [t.strategy, t.entryType].filter(Boolean);
      if (!candidatos.length) {
        rev('Setup', 'El trade no tiene estrategia ni tipo de entrada registrados.', null, plan.setups.join(', '));
      } else if (!candidatos.some(function (c) { return plan.setups.some(function (s) { return coincideSetup(c, s); }); })) {
        rev('Setup', 'No coincide con los setups de tu plan; confírmalo manualmente.', candidatos.join(' / '), plan.setups.join(', '));
      }
    }

    // 12) Pérdida acumulada diaria / semanal / mensual
    function chequeaPerdida(limite, nombre, filtro) {
      if (!limite || !(size > 0)) return;
      var cum = acumulado(filtro);
      if (cum >= 0) return;
      var perdidaPct = (-cum / size) * 100;
      var r = superaMaximo(perdidaPct, limite);
      var txt = perdidaPct.toFixed(2) + '%';
      if (r === 'critica') crit('Pérdida ' + nombre + ' excedida', 'La pérdida acumulada superó tu límite.', txt, 'máx. ' + limite + '%');
      else if (r === 'margen') margen('Pérdida ' + nombre, 'Dentro del margen de tolerancia del 10 %.', txt, 'máx. ' + limite + '%');
    }
    if (t.date) {
      chequeaPerdida(plan.perdidaDiariaMaxPct, 'diaria', function (x) { return x.date === t.date; });
      chequeaPerdida(plan.perdidaSemanalMaxPct, 'semanal', function (x) { return weekKey(x.date) === weekKey(t.date); });
      chequeaPerdida(plan.perdidaMensualMaxPct, 'mensual', function (x) { return x.date.slice(0, 7) === t.date.slice(0, 7); });
    }

    // 13) Drawdown máximo desde que inició la racha
    if (plan.drawdownMaxPct && size > 0) {
      var eq = 0, pico = 0;
      for (var i = 0; i < all.length; i++) {
        var x = all[i];
        if (x.date && x.date >= inicio) {
          eq += num(x.pnlUsd) || 0;
          if (eq > pico) pico = eq;
        }
        if (x.id === t.id) break;
      }
      var dd = ((pico - eq) / size) * 100;
      var r13 = superaMaximo(dd, plan.drawdownMaxPct);
      if (r13 === 'critica') crit('Drawdown excedido', 'El drawdown de la racha superó tu máximo.', dd.toFixed(2) + '%', 'máx. ' + plan.drawdownMaxPct + '%');
      else if (r13 === 'margen') margen('Drawdown', 'Dentro del margen de tolerancia del 10 %.', dd.toFixed(2) + '%', 'máx. ' + plan.drawdownMaxPct + '%');
    }

    // 14) Operar después de alcanzar el límite de pérdidas consecutivas (mismo día)
    var maxConsec = plan['maxPérdidasConsecutivas'];
    if (maxConsec) {
      var previos = dia.slice(0, pos), seguidas = 0;
      for (var j = previos.length - 1; j >= 0; j--) {
        if (previos[j].result === 'loss') seguidas++; else break;
      }
      if (seguidas >= maxConsec) {
        crit('Operó tras pérdidas consecutivas', 'Seguiste operando después de alcanzar tu límite de pérdidas seguidas.', seguidas + ' pérdidas seguidas', 'pausa tras ' + maxConsec);
      }
    }

    var hayCritica = infr.some(function (i) { return i.categoria === 'critica'; });
    var hayRevision = infr.some(function (i) { return i.categoria === 'revision'; });
    return { resultado: hayCritica ? 'invalido' : (hayRevision ? 'pendiente' : 'valido'), infracciones: infr };
  }

  // ── Acceso a Firestore (las funciones llegan desde la página) ─
  function refRacha(o) { return o.fs.doc(o.db, 'users', o.uid, 'rachas', o.racha.id); }
  function colEvals(o) { return o.fs.collection(o.db, 'users', o.uid, 'rachas', o.racha.id, 'evaluaciones'); }

  async function cargarEvals(o) {
    var snap = await o.fs.getDocs(colEvals(o));
    var m = new Map();
    snap.docs.forEach(function (d) { m.set(d.id, d.data()); });
    return m;
  }

  function contar(evals) {
    var v = 0, inv = 0, pen = 0;
    evals.forEach(function (e) {
      if (e.resultado === 'valido') v++;
      else if (e.resultado === 'invalido') inv++;
      else pen++;
    });
    var evaluados = v + inv;
    return {
      tradesValidos: v,
      tradesEvaluados: evaluados,
      infraccionesCriticas: inv,
      tradesPendientes: pen,
      cumplimientoPct: evaluados > 0 ? Math.round((v / evaluados) * 1000) / 10 : 100,
      nivelActual: Math.floor(v / 50) + 1
    };
  }

  async function guardarConteo(o, evals, rotura) {
    var c = contar(evals);
    var upd = {
      tradesValidos: c.tradesValidos, tradesEvaluados: c.tradesEvaluados,
      infraccionesCriticas: c.infraccionesCriticas, tradesPendientes: c.tradesPendientes,
      cumplimientoPct: c.cumplimientoPct, nivelActual: c.nivelActual
    };
    if (rotura) {
      upd.estado = 'rota';
      upd.fechaRuptura = o.fs.serverTimestamp();
      upd.motivoRuptura = rotura.motivo;
    }
    await o.fs.updateDoc(refRacha(o), upd);

    if (rotura) {
      await o.fs.addDoc(o.fs.collection(o.db, 'users', o.uid, 'historialRachas'), {
        rachaId: o.racha.id,
        accountId: o.racha.accountId || null,
        nombre: o.racha.nombre || 'Racha',
        nivelMaximo: c.nivelActual,
        tradesValidos: c.tradesValidos,
        fechaInicio: o.racha.fechaInicio || null,
        fechaFin: o.fs.serverTimestamp(),
        motivoFin: rotura.motivo,
        cumplimientoPromedio: c.cumplimientoPct,
        infraccionesTotal: c.infraccionesCriticas
      });
    }

    // Reflejar en el objeto local de la página
    Object.keys(upd).forEach(function (k) {
      if (k !== 'fechaRuptura') o.racha[k] = upd[k];
    });
    if (rotura) o.racha.fechaRuptura = new Date();
    return c;
  }

  // ── Sincronizar: evalúa los trades nuevos desde que inició la racha ─
  // o = { db, fs, uid, racha, trades, accountSize }
  async function sync(o) {
    var racha = o.racha;
    if (!racha || racha.estado !== 'activa') return { nuevas: 0, rota: null, ultima: null };

    var plan = racha.plan || {};
    var inicio = fechaInicioISO(racha);
    var evals = await cargarEvals(o);
    var todos = (o.trades || []).filter(function (t) { return t && t.id; }).sort(orden);

    var nuevas = 0, ultima = null, rota = null;
    for (var i = 0; i < todos.length; i++) {
      var t = todos[i];
      if (!t.date || t.date < inicio) continue;      // solo operaciones desde que inició la racha
      if (evals.has(t.id)) continue;                  // ya evaluada

      var r = evaluateTrade(t, todos, plan, o.accountSize || 0, inicio);
      var docEval = {
        tradeId: t.id,
        accountId: racha.accountId || null,
        fecha: t.date,
        activo: t.asset || null,
        resultadoTrade: t.result || null,
        pnlUsd: num(t.pnlUsd) || 0,
        resultado: r.resultado,
        cumplePlan: r.resultado === 'valido',
        infracciones: r.infracciones,
        notasManual: null,
        evaluadoEn: o.fs.serverTimestamp()
      };
      await o.fs.setDoc(o.fs.doc(o.db, 'users', o.uid, 'rachas', racha.id, 'evaluaciones', t.id), docEval);
      evals.set(t.id, docEval);
      nuevas++;
      ultima = { resultado: r.resultado, fecha: t.date, activo: t.asset || null, infracciones: r.infracciones };

      if (r.resultado === 'invalido') {
        var criticas = r.infracciones.filter(function (x) { return x.categoria === 'critica'; });
        rota = {
          motivo: 'Trade del ' + t.date + (t.asset ? ' (' + t.asset + ')' : '') + ': ' +
            criticas.map(function (x) { return x.regla; }).join(', ')
        };
        break; // la racha terminó: no se evalúan más trades
      }
    }

    if (nuevas > 0 || rota) await guardarConteo(o, evals, rota);
    var c = contar(evals);
    return { nuevas: nuevas, rota: rota, ultima: ultima, validos: c.tradesValidos, pendientes: c.tradesPendientes };
  }

  // ── Resolver a mano un trade pendiente ───────────────────────
  // resolucion: 'valido' | 'invalido'
  async function resolverPendiente(o, evalId, resolucion, nota) {
    var ref = o.fs.doc(o.db, 'users', o.uid, 'rachas', o.racha.id, 'evaluaciones', evalId);
    await o.fs.updateDoc(ref, {
      resultado: resolucion,
      cumplePlan: resolucion === 'valido',
      notasManual: nota || null
    });
    var evals = await cargarEvals(o);
    var rotura = null;
    if (resolucion === 'invalido') {
      var e = evals.get(evalId) || {};
      rotura = { motivo: 'Declaraste que incumpliste una regla en el trade del ' + (e.fecha || '—') + (e.activo ? ' (' + e.activo + ')' : '') };
    }
    return guardarConteo(o, evals, rotura);
  }

  window.RachaEngine = {
    evaluateTrade: evaluateTrade,
    sync: sync,
    resolverPendiente: resolverPendiente
  };
})();
