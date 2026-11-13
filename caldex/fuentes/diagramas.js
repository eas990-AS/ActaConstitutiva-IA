const sharp = require("sharp");
const fs = require("fs");

const P = { dark: "#3A2418", terra: "#B85042", gold: "#D9A441", green: "#6B8F4E", brown: "#8A6A55", tint: "#F6F0EA", line: "#8A6A55", grid: "#E2D8CE", ink: "#2B211B", quiet: "#6E5A4C" };
const FONT = "Carlito, Liberation Sans, Arial, sans-serif";

const svgWrap = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${P.line}"/></marker></defs>
<rect width="${w}" height="${h}" fill="#FFFFFF"/>${body}</svg>`;

const box = (x, y, w, h, lines, opt = {}) => {
  const fill = opt.fill || P.tint, stroke = opt.stroke || "none", sw = opt.sw || 0;
  const n = lines.length, lh = 22;
  const startY = y + h / 2 - ((n - 1) * lh) / 2 + 7;
  const t = lines.map((l, i) => `<text x="${x + w / 2}" y="${startY + i * lh}" text-anchor="middle" font-size="${i === 0 ? 19 : 16}" font-weight="${i === 0 ? 700 : 400}" fill="${opt.ink || (i === 0 ? P.ink : P.quiet)}">${l}</text>`).join("");
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>${t}`;
};
const arrow = (d, label, lx, ly) => `<path d="${d}" fill="none" stroke="${P.line}" stroke-width="2" marker-end="url(#a)"/>` + (label ? `<text x="${lx}" y="${ly}" font-size="14" fill="${P.quiet}" text-anchor="middle">${label}</text>` : "");
const title = (t, sub) => `<text x="30" y="42" font-size="26" font-weight="700" fill="${P.ink}">${t}</text>` + (sub ? `<text x="30" y="70" font-size="17" fill="${P.quiet}">${sub}</text>` : "");

const out = async (name, svg) => { await sharp(Buffer.from(svg), { density: 144 }).png().toFile(require("path").join(__dirname, "..", "diagramas", name)); console.log(name); };

(async () => {
  // 1. Arquitectura
  {
    const W = 1240, H = 640;
    const bw = 200, bh = 76;
    const cx = 30, dx = 270, fx = 510, tx = 760, ix = 1010;
    const tiendaY = 190, correoY = 470;
    const ints = [["Pagos", "Mercado Pago, Stripe"], ["Facturación CFDI", "Facturapi, Facturama"], ["Envíos", "Paquetería o reparto"], ["Redes sociales", "Meta, WhatsApp, TikTok"]];
    let b = title("Un dominio conecta la tienda, el correo y los servicios", "Arquitectura propuesta del sitio de Caldex");
    b += box(cx, 330 - bh / 2, 200, bh, ["Cliente", "celular o computadora"], { fill: "#FFFFFF", stroke: P.line, sw: 1.5 });
    b += box(dx, 330 - bh / 2, bw, bh, ["caldex.com.mx", "dominio"], { fill: P.terra, ink: "#FFFFFF" });
    b += box(fx, 330 - bh / 2, bw, bh, ["Cloudflare", "DNS, SSL y CDN"]);
    b += box(tx, tiendaY, bw, bh + 20, ["Tienda en línea", "Shopify o Tiendanube", "hospedaje incluido"], { fill: P.gold, ink: P.ink });
    b += box(tx, correoY, bw, bh, ["Correo", "Google Workspace"], { fill: P.green, ink: "#FFFFFF" });
    ints.forEach(([a, s], i) => { b += box(ix, 100 + i * 100, 200, 70, [a, s]); });
    b += arrow(`M${cx + 200} 330H${dx - 4}`);
    b += arrow(`M${dx + bw} 330H${fx - 4}`);
    b += arrow(`M${fx + bw} 330H${fx + bw + 25}V${tiendaY + 48}H${tx - 4}`, "sitio web", fx + bw + 25 + 10, 300).replace('text-anchor="middle"', 'text-anchor="start"');
    b += arrow(`M${fx + bw} 330H${fx + bw + 25}V${correoY + 38}H${tx - 4}`, "registros MX", fx + bw + 35, 385).replace('text-anchor="middle"', 'text-anchor="start"');
    ints.forEach((_, i) => { const y = 135 + i * 100; b += `<path d="M${tx + bw} ${tiendaY + 48}H${tx + bw + 25}V${y}H${ix - 4}" fill="none" stroke="${P.line}" stroke-width="2" marker-end="url(#a)"/>`; });
    b += `<text x="${ix}" y="${100 + 4 * 100 + 30}" font-size="15" fill="${P.quiet}">Todo se registra con</text><text x="${ix}" y="${100 + 4 * 100 + 50}" font-size="15" fill="${P.quiet}">correos @caldex.com.mx</text>`;
    await out("d1_arquitectura.png", svgWrap(W, H, b));
  }
  // 2. Flujo del pedido
  {
    const W = 1240, H = 300, bw = 170, gap = 32, y = 120, bh = 120;
    const steps = [["1. Descubre", "en redes o", "en Google"], ["2. Consulta", "fichas, precios", "y fotos"], ["3. Arma", "su carrito", "y elige envío"], ["4. Paga", "tarjeta, OXXO", "o SPEI"], ["5. Recibe aviso", "por correo", "y WhatsApp"], ["6. Recibe", "su pedido", "y su factura"]];
    let b = title("El cliente compra en seis pasos sin llamar a la empresa", "Flujo de un pedido en el sitio de Caldex");
    steps.forEach((s, i) => {
      const x = 30 + i * (bw + gap);
      const last = i === steps.length - 1;
      b += box(x, y, bw, bh, s, last ? { fill: P.terra, ink: "#FFFFFF" } : (i === 3 ? { fill: P.gold, ink: P.ink } : {}));
      if (!last) b += arrow(`M${x + bw + 2} ${y + bh / 2}H${x + bw + gap - 3}`);
    });
    await out("d2_flujo_pedido.png", svgWrap(W, H, b));
  }
  // 3. Cronograma
  {
    const W = 1240, H = 470, lx = 30, gx = 380, gw = 820, wk = gw / 8, gy = 130, rh = 42;
    const rows = [["Marca, dominio y correo", 1, 2], ["Fotos, textos e identidad", 2, 2], ["Configurar la tienda", 3, 4], ["Facturación, legal y redes", 5, 5], ["Pruebas de compra", 6, 6], ["Lanzamiento suave", 7, 7], ["Lanzamiento oficial", 8, 8]];
    let b = title("El sitio sale en la semana 8", "El registro de marca en el IMPI corre en paralelo y tarda de 4 a 6 meses");
    for (let w = 0; w <= 8; w++) {
      b += `<line x1="${gx + w * wk}" x2="${gx + w * wk}" y1="${gy - 10}" y2="${gy + rows.length * rh}" stroke="${P.grid}" stroke-width="1.5"/>`;
      if (w < 8) b += `<text x="${gx + w * wk + wk / 2}" y="${gy - 20}" text-anchor="middle" font-size="16" fill="${P.quiet}">Sem. ${w + 1}</text>`;
    }
    rows.forEach(([t, a, e], i) => {
      const y = gy + i * rh, last = i === rows.length - 1;
      b += `<text x="${lx}" y="${y + rh / 2 + 6}" font-size="18" font-weight="${last ? 700 : 400}" fill="${P.ink}">${t}</text>`;
      b += `<rect x="${gx + (a - 1) * wk + 6}" y="${y + 9}" width="${(e - a + 1) * wk - 12}" height="${rh - 18}" rx="12" fill="${last ? P.terra : P.gold}"/>`;
    });
    await out("d3_cronograma.png", svgWrap(W, H, b));
  }
  // 4. Costos
  {
    const rows = [["Publicidad en redes", 36000, 36000], ["Tienda en línea y hospedaje", 6000, 18000], ["Fotografía de producto", 3000, 10000], ["Correo (5 usuarios)", 9000, 9000], ["Registro de marca IMPI", 6000, 6000], ["Facturación CFDI", 2400, 6000], ["Tema o diseño del sitio", 0, 6000], ["Dominios", 1000, 1000]];
    const W = 1240, gx = 360, gw = 760, max = 40000, X = v => gx + (v / max) * gw, gy = 120, rh = 46;
    const H = gy + rows.length * rh + 60;
    const fmt = v => "$" + v.toLocaleString("en-US");
    let b = title("La publicidad es el mayor gasto del primer año", "Costo del primer año por concepto, MXN sin IVA (barra clara = rango posible)");
    for (let v = 0; v <= max; v += 10000) {
      b += `<line x1="${X(v)}" x2="${X(v)}" y1="${gy - 6}" y2="${gy + rows.length * rh}" stroke="${P.grid}" stroke-width="1.5"/><text x="${X(v)}" y="${gy + rows.length * rh + 26}" text-anchor="middle" font-size="15" fill="${P.quiet}">${fmt(v)}</text>`;
    }
    rows.forEach(([t, lo, hi], i) => {
      const y = gy + i * rh;
      b += `<text x="30" y="${y + rh / 2 + 6}" font-size="18" fill="${P.ink}">${t}</text>`;
      if (hi > lo) b += `<rect x="${X(lo)}" y="${y + 10}" width="${X(hi) - X(lo)}" height="${rh - 20}" fill="${P.gold}" fill-opacity="0.35"/>`;
      if (lo > 0) b += `<rect x="${X(0)}" y="${y + 10}" width="${X(lo) - X(0)}" height="${rh - 20}" fill="${i === 0 ? P.terra : P.gold}"/>`;
      b += `<text x="${X(hi) + 10}" y="${y + rh / 2 + 6}" font-size="16" fill="${P.quiet}">${lo === hi ? fmt(hi) : fmt(lo) + "–" + fmt(hi)}</text>`;
    });
    await out("d4_costos.png", svgWrap(W, H, b));
  }
})();
