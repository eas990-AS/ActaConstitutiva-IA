# Contexto del proyecto: Sitio web Caldex

> **Para retomar en otro equipo o sesión de Claude:** pide *"Lee `caldex/CONTEXTO.md` y continuemos con el plan del sitio Caldex"*.
> Este archivo resume todo lo decidido hasta el 13 de noviembre de 2026.

## Empresa y marca

- **Razón social:** Caldos Excepcionales S. de R.L. de C.V.
- **Nombre comercial que se usará:** solo **Caldex**.
- **Giro:** caldos (productos alimenticios). Aplican NOM-051 (etiquetado) y COFEPRIS.
- **Dominio principal:** `caldex.com.mx`; `caldex.mx` como redirección.
- **Correo de ejemplo:** `eas@caldex.com.mx`.

## Qué se pidió

Planear el sitio completo: compra del dominio, sitio web de consulta de productos y pedidos, hospedaje, correo corporativo e integración con redes sociales. Se pidió además entregarlo como documento ejecutivo, en PowerPoint y en Word con diagramas.

## Decisiones y recomendaciones

| Tema | Recomendación | Estado |
|---|---|---|
| Plataforma | Plataforma administrada: **Shopify o Tiendanube**, no un VPS propio | Falta elegir entre las dos |
| Hospedaje | Incluido en la plataforma. Alternativa futura: VPS de 2 vCPU y 4 GB (Hetzner, DigitalOcean, Vultr), unos $12–24 USD al mes | — |
| DNS | Cloudflare (gratis, SSL y CDN) | — |
| Registrador | Akky o Cloudflare, a nombre de la empresa | — |
| Correo | **Google Workspace Business Starter, 5 licencias** (~$750 MXN al mes) | Recomendado |
| Buzones de área | `ventas@`, `pedidos@`, `contacto@`, `facturacion@` como grupos sin costo | — |
| Pagos | Mercado Pago, Stripe o Conekta (tarjeta, OXXO, SPEI) | — |
| Facturación | CFDI 4.0 con Facturapi o Facturama | — |
| Marca | Registro en el IMPI, clases 29 y 35 (4 a 6 meses) | Pendiente buscar en MARCia |

### Opciones de correo para 5 personas (MXN aproximados, sin IVA)

| Opción | 5 usuarios al mes | Al año |
|---|---|---|
| Zoho Mail Free | $0 | $0 (limitado, sin IMAP) |
| Zoho Mail Lite | ~$110 | ~$1,300 |
| Microsoft 365 Business Basic | ~$600 | ~$7,200 |
| **Google Workspace Starter (recomendado)** | **~$750** | **~$9,000** |
| Microsoft 365 Business Standard | ~$1,250 | ~$15,000 |
| Google Workspace Business Standard | ~$1,450 | ~$17,400 |

Hay que decidir si `admin@` lleva licencia propia (6 licencias) o si una de las 5 personas administra.

### Shopify contra Tiendanube

| | Shopify | Tiendanube |
|---|---|---|
| Costo | Desde ~$29–39 USD al mes (Basic) | $0 con comisión, o ~$400–500 MXN al mes |
| Moneda | Dólares | Pesos, con factura mexicana |
| Soporte | Español limitado | Español, con equipo en México |
| Fuerte en | Apps, marketing, escala, mayoreo B2B | Sencillez, envíos locales, Mercado Pago |
| Comisión extra | 0.5–2% si se usa una pasarela externa | Según plan |

Sugerencia: abrir la prueba gratis de ambas y cargar 3 o 4 productos en cada una antes de decidir.

## Plan en 8 fases

1. **Marca:** buscar y registrar Caldex en el IMPI; apartar @caldex.mx en redes.
2. **Dominio:** comprar caldex.com.mx y caldex.mx; DNS en Cloudflare.
3. **Correo:** Google Workspace; MX, SPF, DKIM y DMARC; verificación en dos pasos.
4. **Plataforma:** Shopify o Tiendanube; tema con la identidad de Caldex.
5. **Catálogo y pedidos:** fotos, fichas NOM-051, envíos, pagos y CFDI; mayoreo opcional.
6. **Legal:** aviso de privacidad (LFPDPPP 2025), términos, datos para PROFECO, cookies.
7. **Redes:** Meta Business Suite, catálogo de Instagram, WhatsApp Business, TikTok, Google Business, pixeles y Analytics 4.
8. **Lanzamiento:** compras de prueba, lanzamiento suave y oficial.

### Cronograma (semanas)

| Etapa | Semanas |
|---|---|
| Marca, dominio y correo | 1–2 |
| Fotos, textos e identidad | 2 |
| Configurar la tienda | 3–4 |
| Facturación, legal y redes | 5 |
| Pruebas de compra | 6 |
| Lanzamiento suave | 7 |
| Lanzamiento oficial | 8 |

## Costos estimados (MXN, aproximados)

| Concepto | Inicial | Mensual | Primer año |
|---|---|---|---|
| Dominios | $1,000 | — | $1,000 |
| Registro de marca IMPI (2 clases) | $6,000 | — | $6,000 |
| Tema o diseño | $0–6,000 | — | $0–6,000 |
| Fotografía | $3,000–10,000 | — | $3,000–10,000 |
| Tienda y hospedaje | — | $500–1,500 | $6,000–18,000 |
| Correo (5 usuarios) | — | $750 | $9,000 |
| Facturación CFDI | — | $200–500 | $2,400–6,000 |
| Publicidad en redes | — | $3,000 | $36,000 |
| Comisiones de pago | — | 3–4% por venta | Variable |
| **Total sin IVA** | **$10,000–23,000** | **$4,450–5,750** | **$63,400–92,000** |
| **Total con IVA** | $11,600–26,680 | $5,162–6,670 | $73,544–106,720 |

Sin publicidad, el primer año queda en $27,400–56,000. **Los precios son de memoria y no se han verificado en los sitios de los proveedores;** hay que confirmarlos antes de contratar.

## Decisiones pendientes

1. ¿Venta a consumidor final, a mayoreo o a ambos?
2. ¿Entrega local o nacional? ¿Los productos requieren refrigeración?
3. ¿Cuántos productos y presentaciones?
4. ¿Shopify o Tiendanube?
5. ¿Quién administrará el sitio?
6. ¿Ya hay logo y redes activas?

## Entregables

| Archivo | Descripción |
|---|---|
| `caldex/Caldex_Plan_Ejecutivo.docx` | Documento Word de 5 páginas con 4 diagramas |
| `caldex/Caldex_Plan_Ejecutivo.pptx` | Presentación de 10 diapositivas |
| `caldex/diagramas/*.png` | Arquitectura, flujo del pedido, cronograma y costos |
| `caldex/fuentes/` | Scripts que generan los diagramas, el Word y el PowerPoint |
| [Documento en Claude](https://claude.ai/artifact/NThjYQpqzADMNLrckHwYTF) | Versión editable en línea; solo la abre la cuenta que lo creó, salvo que se comparta |

## Cómo regenerar los archivos

```bash
cd caldex/fuentes
npm install
npm run todo          # diagramas, Word y PowerPoint
```

- Para cambiar textos o cifras, edita `documento_word.js`, `presentacion.js` o `diagramas.js` y vuelve a correr el comando.
- Paleta: café `3A2418`, terracota `B85042`, dorado `D9A441` y verde `6B8F4E`. Títulos en Cambria, texto en Calibri.
- La presentación aplica los colores del tema con `apply_theme.js` del skill `pptx` de Claude. Si no está disponible, se genera igual con la paleta por defecto de Office en los elementos que usan colores del tema. Para usarlo, define la variable `APPLY_THEME` con la ruta del script.

## Próximos pasos sugeridos

- Responder las decisiones pendientes.
- Verificar los precios actuales de Shopify, Tiendanube y Google Workspace.
- Buscar "Caldex" en MARCia (IMPI) y la disponibilidad de los dominios.
- Redactar el aviso de privacidad y los términos y condiciones.
