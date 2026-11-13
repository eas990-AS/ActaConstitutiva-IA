const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
// applyTheme viene del skill "pptx" de Claude; si no está disponible, se omite y el archivo usa la paleta por defecto.
let applyTheme = async () => {};
try { ({ applyTheme } = require(process.env.APPLY_THEME || "./apply_theme.js")); } catch (e) { console.warn("apply_theme.js no encontrado: se omite el tema"); }

const THEME = {
  name: "Caldex",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "2B211B", lt1: "FFFFFF", dk2: "3A2418", lt2: "F6F0EA",
    accent1: "B85042", accent2: "D9A441", accent3: "6B8F4E", accent4: "8A6A55",
    accent5: "C97B5A", accent6: "5C4A3D", hlink: "B85042", folHlink: "8A6A55",
  },
};
const HEX = THEME.colors;

const icon = async (name, color) => {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + color, size: 256 }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
};

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = "Plan Ejecutivo: Sitio Web Caldex";
  pres.company = "Caldos Excepcionales S. de R.L. de C.V.";
  const C = pres.SchemeColor;

  pres.defineSlideMaster({
    title: "Portada", background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.6, w: 8.8, h: 1.3, fontSize: 40, bold: true, color: C.background1, valign: "bottom", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.05, w: 8.8, h: 1.0, fontSize: 16, color: C.accent2, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "Contenido", background: { color: HEX.lt1 },
    margin: [0.5, 0.5, 0.6, 0.5],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9.0, h: 0.6, fontSize: 26, bold: true, color: C.text2, valign: "middle", margin: 0 }, text: "" } },
      { text: { text: "Caldex · Plan ejecutivo del sitio web", options: { x: 0.5, y: 5.2, w: 6, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent4, align: "right" },
  });
  pres.defineSlideMaster({
    title: "Cierre", background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9.0, h: 0.65, fontSize: 28, bold: true, color: C.background1, valign: "middle", margin: 0 }, text: "" } },
    ],
  });

  const caption = (s, t) => s.addText(t, { x: 0.5, y: 0.95, w: 9, h: 0.35, fontSize: 13, italic: true, color: C.accent4, margin: 0, isTextBox: true, objectName: "Subtítulo" });
  const circleIcon = async (s, name, x, y, d, fill) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" }, objectName: "Círculo ícono" });
    s.addImage({ data: await icon(name, "FFFFFF"), x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5, altText: name });
  };

  // 1. Portada
  pres.addSection({ title: "Inicio" });
  let s = pres.addSlide({ masterName: "Portada", sectionTitle: "Inicio" });
  s.addText("Plan Ejecutivo: Sitio Web Caldex", { placeholder: "title" });
  s.addText("Caldos Excepcionales S. de R.L. de C.V. · Noviembre 2026", { placeholder: "body" });
  s.addImage({ data: await icon("FaStore", HEX.accent2), x: 0.6, y: 0.7, w: 0.7, h: 0.7, altText: "Tienda" });

  // 2. Resumen
  s = pres.addSlide({ masterName: "Contenido", sectionTitle: "Inicio" });
  s.addText("Caldex puede vender en línea en 8 semanas", { placeholder: "title" });
  caption(s, "Tienda en caldex.com.mx con catálogo, pedidos, pago en línea y redes sociales integradas");
  const stats = [
    ["8", "semanas", "de la compra del dominio al lanzamiento oficial", C.accent1],
    ["$63–92 mil", "MXN + IVA", "inversión estimada del primer año, con publicidad", C.accent2],
    ["5", "cuentas de correo", "en @caldex.com.mx, más buzones de área sin costo", C.accent3],
  ];
  stats.forEach(([big, unit, desc, col], i) => {
    const x = 0.5 + i * 3.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.5, w: 2.8, h: 2.3, rectRadius: 0.12, fill: { color: C.background2 }, line: { type: "none" }, objectName: "Tarjeta dato " + (i + 1) });
    s.addText(big, { x: x + 0.2, y: 1.65, w: 2.4, h: 0.8, fontSize: i === 1 ? 32 : 48, bold: true, color: col, fontFace: THEME.headFontFace, margin: 0, isTextBox: true, valign: "middle" });
    s.addText(unit, { x: x + 0.2, y: 2.45, w: 2.4, h: 0.35, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(desc, { x: x + 0.2, y: 2.85, w: 2.4, h: 0.8, fontSize: 13, color: C.text1, margin: 0, isTextBox: true, valign: "top" });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 4.05, w: 8.9, h: 0.85, rectRadius: 0.1, fill: { color: C.accent1, transparency: 88 }, line: { type: "none" }, objectName: "Recomendación" });
  s.addText([
    { text: "Recomendación: ", options: { bold: true, color: C.accent1 } },
    { text: "plataforma administrada (Shopify o Tiendanube) en lugar de servidor propio: sale más rápido, sin soporte técnico y con redes integradas.", options: { color: C.text1 } },
  ], { x: 0.7, y: 4.1, w: 8.5, h: 0.75, fontSize: 14, margin: 0, isTextBox: true, valign: "middle" });

  // 3. Fases
  pres.addSection({ title: "Plan" });
  s = pres.addSlide({ masterName: "Contenido", sectionTitle: "Plan" });
  s.addText("Ocho fases llevan del nombre al lanzamiento", { placeholder: "title" });
  const fases = [
    ["FaTrademark", "1. Marca", "Registrar Caldex en el IMPI y apartar redes"],
    ["FaGlobe", "2. Dominio", "caldex.com.mx y caldex.mx con DNS en Cloudflare"],
    ["FaEnvelope", "3. Correo", "Google Workspace, 5 cuentas y buzones de área"],
    ["FaStore", "4. Plataforma", "Shopify o Tiendanube; hospedaje incluido"],
    ["FaBoxOpen", "5. Catálogo", "Fotos, fichas NOM-051, envíos, pagos y CFDI"],
    ["FaFileContract", "6. Legal", "Aviso de privacidad, términos y datos PROFECO"],
    ["FaShareAlt", "7. Redes", "Meta, WhatsApp, TikTok y Google Business"],
    ["FaRocket", "8. Lanzamiento", "Pruebas, lanzamiento suave y oficial"],
  ];
  const fcol = [C.accent1, C.accent2, C.accent3, C.accent4];
  const fhex = [HEX.accent1, HEX.accent2, HEX.accent3, HEX.accent4];
  for (let i = 0; i < fases.length; i++) {
    const [ic, t, d] = fases[i];
    const col = i % 4, row = Math.floor(i / 4);
    const x = 0.5 + col * 2.27, y = 1.25 + row * 1.95;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.07, h: 1.75, rectRadius: 0.1, fill: { color: C.background2 }, line: { type: "none" }, objectName: "Fase " + (i + 1) });
    await circleIcon(s, ic, x + 0.15, y + 0.15, 0.5, fhex[col]);
    s.addText(t, { x: x + 0.15, y: y + 0.72, w: 1.8, h: 0.35, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.15, y: y + 1.07, w: 1.8, h: 0.6, fontSize: 12, color: C.text1, margin: 0, isTextBox: true, valign: "top" });
  }

  // 4. Dominio y correo
  s = pres.addSlide({ masterName: "Contenido", sectionTitle: "Plan" });
  s.addText("Dominio y correo van primero", { placeholder: "title" });
  const col2 = async (x, ic, fill, head, items) => {
    await circleIcon(s, ic, x, 1.2, 0.6, fill);
    s.addText(head, { x: x + 0.75, y: 1.2, w: 3.4, h: 0.6, fontSize: 20, bold: true, color: C.text2, margin: 0, isTextBox: true, valign: "middle" });
    s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
      { x, y: 2.0, w: 4.2, h: 3.0, fontSize: 14, color: C.text1, paraSpaceAfter: 6, margin: 0, isTextBox: true, valign: "top" });
  };
  await col2(0.5, "FaGlobe", HEX.accent1, "Dominio", [
    "Comprar caldex.com.mx (principal) y caldex.mx (redirección)",
    "Registrar a nombre de la empresa en Akky o Cloudflare",
    "Renovación automática y bloqueo de transferencia",
    "DNS en Cloudflare: SSL y CDN sin costo",
  ]);
  await col2(5.2, "FaEnvelope", HEX.accent3, "Correo corporativo", [
    "Google Workspace Starter, 5 licencias (~$750 MXN/mes)",
    "Cuentas personales, por ejemplo eas@caldex.com.mx",
    "Grupos sin costo: ventas@, pedidos@, contacto@, facturacion@",
    "Registros MX, SPF, DKIM y DMARC; verificación en dos pasos",
  ]);

  // 5. Plataforma
  s = pres.addSlide({ masterName: "Contenido", sectionTitle: "Plan" });
  s.addText("Shopify escala más; Tiendanube es más simple", { placeholder: "title" });
  caption(s, "Precios aproximados; confirmar en el sitio de cada plataforma");
  const plat = [
    ["Shopify", HEX.accent1, C.accent1, "Desde ~$29–39 USD/mes (Basic)", [
      "Más apps, temas e integraciones de marketing",
      "Escala a cualquier volumen y a mayoreo B2B",
      "Cobra en dólares; las apps suman costo",
      "Comisión extra de 0.5–2% con pasarela externa"]],
    ["Tiendanube", HEX.accent3, C.accent3, "Desde $0 (con comisión) o ~$400–500 MXN/mes", [
      "Cobra en pesos con factura mexicana",
      "Soporte en español y equipo en México",
      "Envíos locales, Mercado Pago, OXXO y WhatsApp",
      "Menos apps; menos flexible para B2B complejo"]],
  ];
  plat.forEach(([name, hx, sc, price, items], i) => {
    const x = 0.5 + i * 4.6;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.45, w: 4.3, h: 3.55, rectRadius: 0.12, fill: { color: C.background2 }, line: { type: "none" }, objectName: "Opción " + name });
    s.addText(name, { x: x + 0.25, y: 1.6, w: 3.8, h: 0.5, fontSize: 22, bold: true, color: sc, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
    s.addText(price, { x: x + 0.25, y: 2.1, w: 3.8, h: 0.35, fontSize: 13, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < items.length - 1 } })),
      { x: x + 0.25, y: 2.55, w: 3.8, h: 2.3, fontSize: 14, color: C.text1, paraSpaceAfter: 6, margin: 0, isTextBox: true, valign: "top" });
  });

  // 6. Funciones
  s = pres.addSlide({ masterName: "Contenido", sectionTitle: "Plan" });
  s.addText("El sitio resuelve consulta, pedido, pago y factura", { placeholder: "title" });
  const funcs = [
    ["FaBoxOpen", HEX.accent1, "Catálogo", "Fotos, ingredientes, tabla nutrimental, sellos NOM-051, alérgenos y vida de anaquel"],
    ["FaTruck", HEX.accent2, "Envíos", "Zonas y costos, pedido mínimo, horarios y cadena de frío si aplica"],
    ["FaCreditCard", HEX.accent3, "Pagos", "Mercado Pago, Stripe o Conekta: tarjetas, OXXO y SPEI"],
    ["FaFileInvoiceDollar", HEX.accent4, "Facturación", "Autofacturación CFDI 4.0 con Facturapi o Facturama"],
    ["FaFileContract", HEX.accent6, "Legal", "Aviso de privacidad, términos de venta, RFC y domicilio visibles"],
    ["FaUsers", HEX.accent5, "Mayoreo", "Sección opcional para restaurantes y tiendas con precios por volumen"],
  ];
  for (let i = 0; i < funcs.length; i++) {
    const [ic, hx, t, d] = funcs[i];
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6, y = 1.25 + row * 1.25;
    await circleIcon(s, ic, x, y, 0.6, hx);
    s.addText(t, { x: x + 0.8, y, w: 3.5, h: 0.35, fontSize: 16, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.8, y: y + 0.35, w: 3.5, h: 0.7, fontSize: 13, color: C.text1, margin: 0, isTextBox: true, valign: "top" });
  }

  // 7. Redes
  s = pres.addSlide({ masterName: "Contenido", sectionTitle: "Plan" });
  s.addText("Las redes venden desde el catálogo de la tienda", { placeholder: "title" });
  const redes = [
    ["FaFacebook", HEX.accent1, "Meta Business Suite", "Facebook e Instagram unidos; catálogo sincronizado e Instagram Shopping"],
    ["FaWhatsapp", HEX.accent3, "WhatsApp Business", "Botón en el sitio, catálogo y, más adelante, avisos de pedido"],
    ["FaTiktok", HEX.accent6, "TikTok", "Pixel y videos de recetas; TikTok Shop si aplica"],
    ["FaGoogle", HEX.accent2, "Google", "Business Profile en Maps, Analytics 4 y Search Console"],
  ];
  for (let i = 0; i < redes.length; i++) {
    const [ic, hx, t, d] = redes[i];
    const x = 0.5 + i * 2.27;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.3, w: 2.07, h: 3.0, rectRadius: 0.1, fill: { color: C.background2 }, line: { type: "none" }, objectName: "Red " + t });
    await circleIcon(s, ic, x + 0.65, 1.5, 0.75, hx);
    s.addText(t, { x: x + 0.12, y: 2.4, w: 1.83, h: 0.6, fontSize: 15, bold: true, color: C.text2, align: "center", margin: 0, isTextBox: true, valign: "middle" });
    s.addText(d, { x: x + 0.15, y: 3.05, w: 1.77, h: 1.15, fontSize: 12, color: C.text1, margin: 0, isTextBox: true, valign: "top" });
  }
  s.addText("Meta Pixel, TikTok Pixel y Analytics miden qué ventas vienen de cada red.", { x: 0.5, y: 4.5, w: 9, h: 0.4, fontSize: 14, italic: true, color: C.accent4, margin: 0, isTextBox: true });

  // 8. Cronograma
  pres.addSection({ title: "Tiempos y costos" });
  s = pres.addSlide({ masterName: "Contenido", sectionTitle: "Tiempos y costos" });
  s.addText("El sitio sale en la semana 8", { placeholder: "title" });
  caption(s, "El registro de marca en el IMPI corre en paralelo y tarda de 4 a 6 meses");
  const gx = 3.0, gw = 6.4, wk = gw / 8, gy = 1.75, rh = 0.43;
  for (let w = 0; w < 8; w++) {
    s.addText("Sem. " + (w + 1), { x: gx + w * wk, y: 1.38, w: wk, h: 0.3, fontSize: 11, color: C.accent4, align: "center", margin: 0, isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: gx + w * wk, y: gy, w: 0, h: rh * 7, line: { color: "E2D8CE", width: 0.75 }, objectName: "Guía semana " + (w + 1) });
  }
  s.addShape(pres.shapes.LINE, { x: gx + gw, y: gy, w: 0, h: rh * 7, line: { color: "E2D8CE", width: 0.75 }, objectName: "Guía fin" });
  const tareas = [
    ["Marca, dominio y correo", 1, 2], ["Fotos, textos e identidad", 2, 2], ["Configurar la tienda", 3, 4],
    ["Facturación, legal y redes", 5, 5], ["Pruebas de compra", 6, 6], ["Lanzamiento suave", 7, 7], ["Lanzamiento oficial", 8, 8],
  ];
  tareas.forEach(([t, a, b], i) => {
    const y = gy + i * rh;
    const last = i === tareas.length - 1;
    s.addText(t, { x: 0.5, y, w: 2.4, h: rh, fontSize: 13, bold: last, color: C.text1, margin: 0, isTextBox: true, valign: "middle" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: gx + (a - 1) * wk + 0.05, y: y + 0.08, w: (b - a + 1) * wk - 0.1, h: rh - 0.16, rectRadius: 0.13, fill: { color: last ? C.accent1 : C.accent2 }, line: { type: "none" }, objectName: "Barra " + t });
  });

  // 9. Costos
  s = pres.addSlide({ masterName: "Contenido", sectionTitle: "Tiempos y costos" });
  s.addText("Primer año: $63,400–92,000 MXN + IVA", { placeholder: "title" });
  caption(s, "Precios aproximados en MXN; sin publicidad el rango baja a $27,400–56,000");
  const hdr = { bold: true, color: C.background1, fill: { color: C.text2 } };
  const rows = [
    ["Concepto", "Inicial", "Mensual", "Primer año"],
    ["Dominios caldex.com.mx y caldex.mx", "$1,000", "—", "$1,000"],
    ["Registro de marca IMPI (2 clases)", "$6,000", "—", "$6,000"],
    ["Tema o diseño del sitio", "$0–6,000", "—", "$0–6,000"],
    ["Fotografía de producto", "$3,000–10,000", "—", "$3,000–10,000"],
    ["Tienda en línea y hospedaje", "—", "$500–1,500", "$6,000–18,000"],
    ["Correo Google Workspace (5 usuarios)", "—", "$750", "$9,000"],
    ["Facturación CFDI", "—", "$200–500", "$2,400–6,000"],
    ["Publicidad en redes", "—", "$3,000", "$36,000"],
    ["Comisiones de pago", "—", "3–4% por venta", "Variable"],
    ["Total sin IVA", "$10,000–23,000", "$4,450–5,750", "$63,400–92,000"],
    ["Total con IVA (16%)", "$11,600–26,680", "$5,162–6,670", "$73,544–106,720"],
  ];
  const tdata = rows.map((r, i) => r.map((c, j) => {
    const o = { align: j === 0 ? "left" : "right" };
    if (i === 0) Object.assign(o, hdr);
    else if (i >= rows.length - 2) Object.assign(o, { bold: true, color: C.text2, fill: { color: C.background2 } });
    else o.color = C.text1;
    return { text: c, options: o };
  }));
  s.addTable(tdata, { x: 0.5, y: 1.4, w: 9.0, colW: [3.6, 1.8, 1.7, 1.9], rowH: 0.28, fontSize: 11, margin: [0, 0.08, 0, 0.08], valign: "middle", border: { type: "solid", pt: 0.5, color: "E2D8CE" }, objectName: "Tabla de costos" });

  // 10. Decisiones
  pres.addSection({ title: "Siguientes pasos" });
  s = pres.addSlide({ masterName: "Cierre", sectionTitle: "Siguientes pasos" });
  s.addText("Seis decisiones definen el alcance final", { placeholder: "title" });
  const dec = [
    "¿Consumidor final, mayoreo o ambos?",
    "¿Entrega local o nacional? ¿Requiere refrigeración?",
    "¿Cuántos productos y presentaciones?",
    "¿Shopify o Tiendanube?",
    "¿Quién administrará el sitio?",
    "¿Ya hay logo y redes activas?",
  ];
  dec.forEach((d, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6, y = 1.35 + row * 1.2;
    s.addShape(pres.shapes.OVAL, { x, y, w: 0.6, h: 0.6, fill: { color: C.accent2 }, line: { type: "none" }, objectName: "Número " + (i + 1) });
    s.addText(String(i + 1), { x, y, w: 0.6, h: 0.6, fontSize: 18, bold: true, color: C.text2, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.8, y, w: 3.6, h: 0.6, fontSize: 15, color: C.background1, valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText("Siguiente paso: abrir las pruebas gratis de ambas plataformas y comprar los dominios en la semana 1.", { x: 0.5, y: 4.85, w: 9, h: 0.4, fontSize: 14, italic: true, color: C.accent2, margin: 0, isTextBox: true });

  const out = require("path").join(__dirname, "..", "Caldex_Plan_Ejecutivo.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("ok");
})().catch(e => { console.error(e); process.exit(1); });
