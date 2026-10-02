/**
 * Datos de ejemplo: 2 zonas en CDMX, un admin, un supervisor, 2 repartidores
 * y 12 paquetes para hoy. Uso: npm run seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { operationDate } from '../src/common/dates';

const prisma = new PrismaClient();

const centro = [
  { lat: 19.4405, lng: -99.1460 },
  { lat: 19.4405, lng: -99.1240 },
  { lat: 19.4250, lng: -99.1240 },
  { lat: 19.4250, lng: -99.1460 },
];
const romaCondesa = [
  { lat: 19.4240, lng: -99.1800 },
  { lat: 19.4240, lng: -99.1520 },
  { lat: 19.4040, lng: -99.1520 },
  { lat: 19.4040, lng: -99.1800 },
];

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('La base ya tiene datos; no se carga el ejemplo.');
    return;
  }
  const zA = await prisma.zone.create({ data: { name: 'Centro', color: '#2563eb', polygon: centro } });
  const zB = await prisma.zone.create({ data: { name: 'Roma-Condesa', color: '#16a34a', polygon: romaCondesa } });

  const hash = (p: string) => bcrypt.hash(p, 10);
  await prisma.user.create({
    data: { name: 'Administrador', username: 'admin', passwordHash: await hash('admin123'), role: 'ADMIN' },
  });
  await prisma.user.create({
    data: { name: 'Sofía Supervisora', username: 'supervisor', passwordHash: await hash('super123'), role: 'SUPERVISOR' },
  });
  const r1 = await prisma.user.create({
    data: { name: 'Juan Pérez', username: 'juan', passwordHash: await hash('reparto123'), role: 'COURIER', zoneId: zA.id, phone: '5512345678' },
  });
  const r2 = await prisma.user.create({
    data: { name: 'María López', username: 'maria', passwordHash: await hash('reparto123'), role: 'COURIER', zoneId: zB.id, phone: '5587654321' },
  });

  const today = operationDate();
  const samples = [
    ['Av. 5 de Mayo 10, Centro', 19.4338, -99.1386, r1, zA],
    ['Madero 32, Centro', 19.4334, -99.1371, r1, zA],
    ['República de Brasil 5, Centro', 19.4372, -99.1342, r1, zA],
    ['Bolívar 21, Centro', 19.4310, -99.1393, r1, zA],
    ['Venustiano Carranza 50, Centro', 19.4299, -99.1355, r1, zA],
    ['Donceles 80, Centro', 19.4363, -99.1366, r1, zA],
    ['Álvaro Obregón 130, Roma Nte.', 19.4167, -99.1617, r2, zB],
    ['Orizaba 87, Roma Nte.', 19.4175, -99.1593, r2, zB],
    ['Ámsterdam 240, Condesa', 19.4123, -99.1701, r2, zB],
    ['Tamaulipas 66, Condesa', 19.4105, -99.1745, r2, zB],
    ['Colima 180, Roma Nte.', 19.4196, -99.1641, r2, zB],
    ['Michoacán 30, Condesa', 19.4089, -99.1712, r2, zB],
  ] as const;
  const names = ['Ana Torres', 'Luis García', 'Carmen Ruiz', 'Pedro Sánchez', 'Laura Díaz', 'Jorge Méndez',
    'Elena Castro', 'Raúl Ortiz', 'Patricia Vega', 'Miguel Romero', 'Lucía Flores', 'Diego Herrera'];
  for (const [i, [address, lat, lng, courier, zone]] of samples.entries()) {
    await prisma.package.create({
      data: {
        trackingCode: `PKG-${today.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
        recipientName: names[i],
        recipientPhone: `55${String(10000000 + i * 1234567).slice(0, 8)}`,
        address,
        lat,
        lng,
        scheduledDate: today,
        status: 'ASSIGNED',
        zoneId: zone.id,
        courierId: courier.id,
      },
    });
  }
  console.log('Datos de ejemplo cargados.');
  console.log('  admin / admin123 · supervisor / super123 · juan / reparto123 · maria / reparto123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
