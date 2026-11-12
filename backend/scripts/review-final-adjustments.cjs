// Chrome/CDP sin dependencias adicionales. Ejecutar exclusivamente como
// OPERATIONS_BROWSER_REVIEW del script test-database.cjs (BD temporal propia).
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
if (
  !process.env.REVIEW_URL ||
  !/\/real_ejecutivo_test_[a-f0-9]+(?:\?|$)/.test(
    process.env.DATABASE_URL ?? '',
  )
)
  throw new Error('Requiere test:database y su base aislada.');
const artifacts = mkdtempSync(
  path.join(process.env.LOCALAPPDATA, 'Temp/opencode/final-adjustments-'),
);
const chrome = spawn(
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${path.join(artifacts, 'profile')}`,
    '--no-first-run',
    'about:blank',
  ],
);
const endpoint = new Promise((resolve, reject) => {
  chrome.stderr.on('data', (c) => {
    const m = String(c).match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (m) resolve(m[1]);
  });
  chrome.once('error', reject);
});
let ws,
  session,
  nextId = 0;
const pending = new Map(),
  errors = [];
function call(method, params = {}, s = session) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    ws.send(
      JSON.stringify({ id, method, params, ...(s ? { sessionId: s } : {}) }),
    );
  });
}
async function evaluate(expression) {
  const r = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails)
    throw new Error(
      r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
    );
  return r.result.value;
}
const button = (name) =>
  `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(name)}||e.getAttribute('aria-label')===${JSON.stringify(name)})`;
async function wait(condition) {
  await evaluate(
    `new Promise((resolve,reject)=>{const end=Date.now()+15000;function check(){if(${condition})return resolve(true);if(Date.now()>end)return reject(new Error('No apareció: '+${JSON.stringify(condition)}+'; '+document.body.innerText.slice(-1500)));requestAnimationFrame(check);}check();})`,
  );
}
async function click(name) {
  await wait(button(name));
  await evaluate(`${button(name)}.click()`);
}
async function field(label, value) {
  await evaluate(
    `(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;const el=[...root.querySelectorAll('input,select,textarea')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}||e.closest('label')?.textContent.trim().startsWith(${JSON.stringify(label)}));if(!el)throw new Error('Campo ausente: '+${JSON.stringify(label)});const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
}
async function api(url, body) {
  return evaluate(
    `fetch(${JSON.stringify(url)},{credentials:'include',${body ? `method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(body))}` : ''}}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(JSON.stringify(b));return b;})`,
  );
}
async function snapshot() {
  return api('/api/operations');
}
async function command(value) {
  const s = await snapshot();
  return api('/api/operations/commands', {
    commandId: crypto.randomUUID(),
    revision: s.revision,
    command: value,
  });
}
async function shot(name) {
  await wait(
    "innerWidth>768||!document.querySelector('.sidebar:not(.is-open)')||document.querySelector('.sidebar').getBoundingClientRect().right<=1",
  );
  assert(
    await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),
    'Desbordamiento horizontal',
  );
  const s = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  writeFileSync(path.join(artifacts, name), Buffer.from(s.data, 'base64'));
}
async function reload() {
  await call('Page.reload');
  await wait("document.querySelector('.app-shell')");
}
async function login(username) {
  await api('/api/auth/login', { username, password: 'Test-Operations-123' });
  await reload();
}

(async () => {
  const deadline = Date.now() + 20000;
  const health = new URL('/health', process.env.REVIEW_URL);
  health.port = String(Number(health.port) - 1000);
  while (true) {
    try {
      const response = await fetch(health);
      if (response.ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error('API temporal no inició.');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  ws = new WebSocket(await endpoint);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const task = pending.get(m.id);
      pending.delete(m.id);
      if (task)
        m.error
          ? task.reject(new Error(m.error.message))
          : task.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown')
      errors.push(
        m.params.exceptionDetails.exception?.description ??
          m.params.exceptionDetails.text,
      );
  });
  const t = await call('Target.createTarget', { url: 'about:blank' }, null);
  session = (
    await call(
      'Target.attachToTarget',
      { targetId: t.targetId, flatten: true },
      null,
    )
  ).sessionId;
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source:
      "window.print=()=>{window.__printed=true};for(const m of ['getItem','setItem','removeItem','clear'])Storage.prototype[m]=()=>{throw new Error('Storage prohibido en prueba')};",
  });
  await call('Page.navigate', { url: process.env.REVIEW_URL });
  await wait("document.querySelector('form')");
  await login('ops-admin');
  await click('Personal del taller');
  await click('Agregar empleado');
  await field('Nombre', 'Responsable visual');
  await field('Puesto', 'Mecánica');
  await click('Guardar empleado');
  await wait("!document.querySelector('dialog[open]')");
  await shot('personal-desktop.png');
  const employee = (await snapshot()).workbench.workshop.employees.find(
    (v) => v.name === 'Responsable visual',
  );
  assert(employee);
  await click('Proveedores');
  await click('Agregar proveedor');
  await field('Nombre', 'Proveedor visual');
  await field('Servicio que proporciona', 'Puertas');
  await field('Teléfono *', '5551234567');
  await click('Guardar proveedor');
  await wait("!document.querySelector('dialog[open]')");
  const supplier = (await snapshot()).workbench.workshop.suppliers.find(
    (v) => v.name === 'Proveedor visual',
  );
  assert(supplier);
  const orderCount = (await snapshot()).workbench.orders.length;
  await click('Solicitudes de servicio');
  await click('Nueva orden');
  await field('Unidad (Autobús o Sprinter)', 'BUS015');
  await field('Responsable de la orden', employee.id);
  await click('Agregar nuevo responsable');
  await field('Nombre', 'Alta contextual');
  await field('Puesto', 'Electricista');
  await click('Guardar empleado');
  await wait("!document.querySelector('dialog[open]')");
  assert.equal(
    await evaluate(
      'document.querySelector(\'select[aria-label="Responsable de la orden"]\').value',
    ),
    (await snapshot()).workbench.workshop.employees.find(
      (v) => v.name === 'Alta contextual',
    ).id,
  );
  assert.equal((await snapshot()).workbench.orders.length, orderCount);
  assert.equal(
    await evaluate("document.querySelectorAll('[role=alert]').length"),
    0,
  );
  await evaluate(
    "[...document.querySelectorAll('label')].find(e=>e.textContent.trim()==='Proveedor de servicios').querySelector('input').click()",
  );
  await field('Responsable de la orden', supplier.id);
  await click('Agregar correctivo libre');
  await field('Trabajo a realizar', 'Correctivo visual');
  await field('Instrucciones', 'Ajustar puerta con registro');
  await field('Fecha estimada de terminación', '2026-11-15');
  await shot('orden-desktop.png');
  await click('Crear orden');
  await wait(
    "document.querySelector('h1')?.textContent.includes('Órdenes de trabajo')",
  );
  let s = await snapshot();
  const order = s.workbench.orders.find((v) =>
    v.form.services.some((x) => x.name === 'Correctivo visual'),
  );
  assert(order);
  assert.equal(
    s.workbench.circulationDecisions.find((v) => v.busId === 'BUS015').status,
    'unauthorized',
  );
  await click('Ver detalles');
  await click('Imprimir orden de trabajo');
  await wait('window.__printed');
  let pdf = await call('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
  });
  writeFileSync(
    path.join(artifacts, 'orden.pdf'),
    Buffer.from(pdf.data, 'base64'),
  );
  assert(
    (
      await evaluate("document.querySelector('.requisition-sheet').textContent")
    ).includes('Recibido del responsable'),
  );
  await evaluate("window.dispatchEvent(new Event('afterprint'))");
  await click('Registrar servicio externo');
  await field('Servicio realizado', 'Servicio visual en taller');
  await field('Costo de mano de obra', '500');
  await click('Guardar servicio externo');
  await wait("!document.querySelector('dialog[open]')");
  assert.equal(
    (await snapshot()).workbench.externalServices.filter(
      (v) => v.orderId === order.id,
    ).length,
    1,
  );
  await click('Unidades');
  await click('BUS015 · Ver historial');
  await click('Agregar artículo de la unidad');
  await field('Nombre', 'Escoba visual');
  await field('Cantidad', '2');
  await field('Motivo del alta', 'Dotación visual');
  await click('Guardar registro');
  await wait("!document.querySelector('dialog[open]')");
  await click('Agregar reparación anterior al software');
  await field('Fecha de reparación', '2025-01-01');
  await field('Trabajo realizado', 'Antecedente visual anterior');
  await click('Guardar registro');
  await wait("!document.querySelector('dialog[open]')");
  await evaluate(
    "[...document.querySelectorAll('tr')].find(r=>r.textContent.includes('Correctivo visual'))?.querySelector('button')?.click()",
  );
  await wait(
    "document.querySelector('dialog[open]')?.textContent.includes('Orden completa')",
  );
  await shot('orden-modal-desktop.png');
  await click('Cerrar ventana');
  await click('Imprimir historial completo (horizontal)');
  await call('Emulation.setEmulatedMedia', { media: 'print' });
  pdf = await call('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
  });
  const historyPdf = Buffer.from(pdf.data, 'base64');
  writeFileSync(path.join(artifacts, 'historial-horizontal.pdf'), historyPdf);
  assert(
    /\/MediaBox\s*\[\s*0\s+0\s+841/.test(historyPdf.toString('latin1')),
    'Historial no horizontal',
  );
  await evaluate("window.dispatchEvent(new Event('afterprint'))");
  await call('Emulation.setEmulatedMedia', { media: '' });
  await call('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await shot('historial-mobile.png');
  // Pre/post real: plantilla propia y unidad libre, sin usar los casos de la suite HTTP.
  await command({
    type: 'review.save',
    id: 'trip',
    clientId: 'trip',
    input: {
      name: 'Viaje visual',
      description: '',
      frequency: 'trip',
      intervalDays: null,
      aspects: [{ id: 'door', text: 'Puerta visual' }],
    },
  });
  await login('ops-driver');
  await click('Abrir menú');
  await click('Revisiones');
  await click('Iniciar caso de revisión');
  await wait(
    "!document.body.textContent.includes('Cargando unidades desde el servidor')",
  );
  await field('Unidad del viaje', 'BUS015');
  await field('Fecha de ida', '2026-11-07');
  await field('Fecha de regreso', '2026-11-07');
  await click('Iniciar caso');
  await wait("!document.querySelector('dialog[open]')");
  await click('Realizar pre trip');
  await evaluate(
    "[...document.querySelectorAll('label')].find(e=>e.textContent.trim()==='Con falla').querySelector('input').click()",
  );
  await field(
    'Observaciones de la revisión',
    'Puerta visual no abre y falta una escoba',
  );
  await field('Cantidad existente de Escoba visual', '1');
  await field('Acción para este aspecto', 'request');
  await shot('pre-mobile.png');
  await click('Enviar revisión pre trip');
  await wait("!document.querySelector('dialog[open]')");
  s = await snapshot();
  const article = s.workbench.workshop.articles.find(
    (v) => v.name === 'Escoba visual',
  );
  assert.equal(article.quantity, 1);
  assert(s.workbench.requests.some((v) => v.sourceIncidentId));
  await reload();
  await click('Abrir menú');
  await click('Revisiones');
  await click('Realizar post trip');
  await evaluate(
    "[...document.querySelectorAll('label')].find(e=>e.textContent.trim()==='Bien').querySelector('input').click()",
  );
  await field('Observaciones de la revisión', 'Escoba recuperada');
  await field('Cantidad existente de Escoba visual', '2');
  await click('Enviar revisión post trip');
  await wait("!document.querySelector('dialog[open]')");
  assert.equal(
    (await snapshot()).workbench.workshop.articles.find(
      (v) => v.id === article.id,
    ).quantity,
    2,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: 'PASS',
      scope:
        'Chrome real + API + PostgreSQL temporal, escritorio 1440 y móvil 375, Storage bloqueado, alta contextual, orden, historial emergente, pre/post y PDF horizontal',
      artifacts,
      pageErrors: errors,
    }),
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    ws?.close();
    chrome.kill();
  });
