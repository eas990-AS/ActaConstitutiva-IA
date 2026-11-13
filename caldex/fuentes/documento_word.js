const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, Footer, PageNumber, TableOfContents,
} = require("docx");

const COL = { dark: "3A2418", terra: "B85042", gold: "D9A441", green: "6B8F4E", quiet: "6E5A4C", tint: "F6F0EA", grid: "E2D8CE" };
const FONT = "Calibri", HFONT = "Cambria";
const CW = 9360;

const p = (text, opt = {}) => new Paragraph({ spacing: { after: 120 }, ...opt.para, children: (Array.isArray(text) ? text : [text]).map(t => typeof t === "string" ? new TextRun({ text: t, ...opt.run }) : t) });
const b = t => new TextRun({ text: t, bold: true });
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (t, ref = "bullets") => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: (Array.isArray(t) ? t : [t]).map(x => typeof x === "string" ? new TextRun(x) : x) });
const check = t => bullet(t, "checks");
const num = t => bullet(t, "nums");
const caption = t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: t, italics: true, size: 18, color: COL.quiet })] });
const img = (file, w, h, alt) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: "png", data: fs.readFileSync(require("path").join(__dirname, "..", "diagramas", file)), transformation: { width: 624, height: Math.round(624 * h / w) }, altText: { title: alt, description: alt, name: alt } })] });

const border = { style: BorderStyle.SINGLE, size: 4, color: COL.grid };
const borders = { top: border, bottom: border, left: border, right: border };
const table = (widths, rows, opt = {}) => new Table({
  width: { size: CW, type: WidthType.DXA }, columnWidths: widths,
  rows: rows.map((r, i) => new TableRow({
    tableHeader: i === 0,
    children: r.map((c, j) => {
      const head = i === 0, total = opt.totals && i >= rows.length - opt.totals;
      return new TableCell({
        borders, width: { size: widths[j], type: WidthType.DXA },
        shading: head ? { fill: COL.dark, type: ShadingType.CLEAR, color: "auto" } : total ? { fill: COL.tint, type: ShadingType.CLEAR, color: "auto" } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ alignment: j > 0 && opt.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: c, bold: head || total, color: head ? "FFFFFF" : undefined, size: 20 })] })],
      });
    }),
  })),
});

const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Plan Ejecutivo: Sitio Web Caldex")] }),
  p([new TextRun({ text: "Caldos Excepcionales S. de R.L. de C.V.", bold: true }), new TextRun({ text: "  ·  13 de noviembre de 2026", color: COL.quiet })], { para: { spacing: { after: 240 } } }),

  h1("Resumen ejecutivo"),
  p(["Caldex puede tener su tienda en línea operando en ", b("8 semanas"), ", con una inversión aproximada de ", b("$63,400 a $92,000 MXN más IVA el primer año"), " (incluye publicidad)."]),
  bullet([b("Objetivo: "), "un sitio en caldex.com.mx para consultar productos y hacer pedidos con pago en línea, integrado con las redes sociales de la empresa."]),
  bullet([b("Recomendación: "), "usar una plataforma administrada (Shopify o Tiendanube) en lugar de rentar un servidor propio. Sale más rápido, requiere menos soporte técnico y se integra de forma nativa con Facebook, Instagram y TikTok."]),
  bullet([b("Correo: "), "Google Workspace para 5 personas (por ejemplo eas@caldex.com.mx), más buzones de área sin costo como ventas@ y pedidos@."]),
  bullet([b("Marca: "), "solo se usará el nombre comercial Caldex, por lo que conviene registrarlo en el IMPI antes de invertir en publicidad."]),
  img("d1_arquitectura.png", 1240, 640, "Arquitectura propuesta del sitio de Caldex"),
  caption("Figura 1. El dominio caldex.com.mx conecta la tienda, el correo y los servicios externos."),

  h1("Pasos del plan"),
  h2("1. Proteger la marca"),
  check("Buscar \"Caldex\" en el buscador MARCia del IMPI (clases 29 y 35)."),
  check("Solicitar el registro de marca en ambas clases (tarda de 4 a 6 meses)."),
  check("Apartar el mismo nombre en Facebook, Instagram, TikTok, WhatsApp Business y YouTube (por ejemplo @caldex.mx)."),
  h2("2. Comprar el dominio"),
  check("Comprar caldex.com.mx (principal) y caldex.mx (redirección) en Akky o Cloudflare."),
  check("Registrarlos a nombre de Caldos Excepcionales S. de R.L. de C.V."),
  check("Activar renovación automática y bloqueo de transferencia."),
  check("Administrar el DNS en Cloudflare (gratis, incluye SSL y CDN)."),
  h2("3. Correo corporativo (5 personas)"),
  check("Contratar Google Workspace Business Starter con 5 licencias."),
  check("Verificar el dominio y configurar los registros MX, SPF, DKIM y DMARC."),
  check("Crear las cuentas personales, por ejemplo eas@caldex.com.mx."),
  check("Crear los grupos sin costo: ventas@, pedidos@, contacto@ y facturacion@."),
  check("Activar la verificación en dos pasos para todos y nombrar un administrador de respaldo."),
  check("Usar estos correos para registrar la tienda, los pagos, las redes y el IMPI."),
  h2("4. Plataforma y hospedaje"),
  check("Elegir Shopify o Tiendanube; el hospedaje y el SSL vienen incluidos."),
  check("Elegir y personalizar el tema visual con el logo y colores de Caldex."),
  check("Conectar el dominio caldex.com.mx a la tienda."),
  p("Comparativo de las dos plataformas (precios aproximados; confirmar en el sitio de cada una):", { para: { spacing: { before: 120, after: 120 } } }),
  table([2400, 3480, 3480], [
    ["", "Shopify", "Tiendanube"],
    ["Costo mensual", "Desde ~$29–39 USD (Basic)", "Desde $0 con comisión, o ~$400–500 MXN"],
    ["Moneda y factura", "Dólares", "Pesos, con factura mexicana"],
    ["Soporte", "Español limitado, por chat", "Español, con equipo en México"],
    ["Apps e integraciones", "Las más amplias del mercado", "Menos, pero con lo local incluido"],
    ["Mayoreo (B2B)", "Sí, con apps", "Limitado"],
    ["Comisión extra", "0.5–2% con pasarela externa", "Según plan; 0% en planes altos con Pago Nube"],
    ["Ideal para", "Crecer rápido e invertir en anuncios", "Arrancar simple y en pesos"],
  ]),
  p("Si más adelante se requiere un servidor propio, la alternativa es un VPS (Hetzner, DigitalOcean o Vultr) de 2 vCPU y 4 GB de RAM, por unos $12–24 USD al mes más mantenimiento técnico.", { para: { spacing: { before: 160, after: 120 } } }),
  h2("5. Catálogo y pedidos"),
  check("Tomar fotografías profesionales de cada producto."),
  check("Cargar fichas con ingredientes, tabla nutrimental, sellos NOM-051, alérgenos y vida de anaquel."),
  check("Definir zonas y costos de envío, pedido mínimo y horarios de entrega."),
  check("Conectar la pasarela de pago (Mercado Pago, Stripe o Conekta), con tarjetas, OXXO y SPEI."),
  check("Activar la autofacturación CFDI 4.0 (Facturapi o Facturama)."),
  check("Evaluar una sección de mayoreo para restaurantes y tiendas."),
  img("d2_flujo_pedido.png", 1240, 300, "Flujo de un pedido en el sitio de Caldex"),
  caption("Figura 2. Recorrido del cliente, desde que descubre a Caldex hasta que recibe su pedido y factura."),
  h2("6. Requisitos legales"),
  check("Publicar el aviso de privacidad (Ley Federal de Protección de Datos Personales en Posesión de los Particulares, 2025)."),
  check("Publicar términos y condiciones: precios con IVA, devoluciones, entregas y cobertura."),
  check("Mostrar razón social, RFC, domicilio y contacto, como pide PROFECO."),
  check("Publicar la política de cookies."),
  h2("7. Redes sociales"),
  check("Configurar Meta Business Suite y unir Facebook e Instagram."),
  check("Sincronizar el catálogo de la tienda con Meta (Instagram Shopping)."),
  check("Instalar Meta Pixel, TikTok Pixel y Google Analytics 4."),
  check("Agregar el botón de WhatsApp Business y su catálogo."),
  check("Crear el perfil de Google Business para aparecer en Maps."),
  h2("8. Pruebas y lanzamiento"),
  check("Hacer compras de prueba con pago, factura y entrega reales."),
  check("Revisar el sitio en celular y su velocidad de carga."),
  check("Lanzamiento suave con clientes conocidos y luego lanzamiento oficial en redes."),

  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Cronograma")] }),
  p("Marca, dominio y correo van primero porque todas las demás cuentas se registran con el correo corporativo.", { para: { spacing: { after: 120 }, keepNext: true } }),
  img("d3_cronograma.png", 1240, 470, "Cronograma de 8 semanas"),
  caption("Figura 3. Cronograma por semana."),

  h1("Costos"),
  p(["El primer año cuesta entre ", b("$63,400 y $92,000 MXN más IVA"), ". Sin publicidad, el rango baja a $27,400–56,000 MXN."]),
  table([3760, 1900, 1700, 2000], [
    ["Concepto", "Inicial (MXN)", "Mensual (MXN)", "Primer año (MXN)"],
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
  ], { right: true, totals: 2 }),
  img("d4_costos.png", 1240, 548, "Costo del primer año por concepto"),
  caption("Figura 4. Costo del primer año por concepto. La barra clara indica el rango posible."),
  p("Los precios son aproximados y deben confirmarse al contratar. Los buzones de área (ventas@, pedidos@, contacto@, facturacion@) no tienen costo. El IMPI cobra derechos que no causan IVA, por lo que el total con IVA es una estimación conservadora.", { run: { size: 20, color: COL.quiet } }),

  h1("Decisiones pendientes"),
  p("Estas respuestas definen el alcance final y el costo exacto:"),
  num("¿Se venderá a consumidor final, a negocios (mayoreo) o a ambos?"),
  num("¿La entrega será local o nacional? ¿Los productos requieren refrigeración?"),
  num("¿Cuántos productos y presentaciones se publicarán?"),
  num("¿Shopify o Tiendanube?"),
  num("¿Quién administrará el sitio: alguien del equipo o un proveedor externo?"),
  num("¿La empresa ya tiene logo y redes sociales activas?"),
];

const doc = new Document({
  creator: "Caldex", title: "Plan Ejecutivo: Sitio Web Caldex",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: HFONT, size: 48, bold: true, color: COL.dark }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: HFONT, size: 32, bold: true, color: COL.terra }, paragraph: { spacing: { before: 360, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true, color: COL.dark }, paragraph: { spacing: { before: 240, after: 80 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: "checks", levels: [{ level: 0, format: LevelFormat.BULLET, text: "☐", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } }, run: { font: "Segoe UI Symbol" } } }] },
      { reference: "nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Caldex · Plan ejecutivo del sitio web · Página ", size: 18, color: COL.quiet }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COL.quiet })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(require("path").join(__dirname, "..", "Caldex_Plan_Ejecutivo.docx"), buf); console.log("ok"); });
