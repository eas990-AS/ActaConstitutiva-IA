import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { verifyToken } from './auth';
import { PrismaService } from './prisma.service';

/**
 * Canal en tiempo real para el panel. Solo ADMIN y SUPERVISOR.
 * Los supervisores con zona asignada se unen a la sala de su zona; el resto, a 'all'.
 */
@WebSocketGateway({ namespace: '/live', cors: { origin: true } })
export class LiveGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    const user = token ? await verifyToken(this.jwt, this.prisma, token) : null;
    if (!user || user.role === 'COURIER') {
      client.emit('error', { message: 'No autorizado' });
      client.disconnect(true);
      return;
    }
    client.join(user.role === 'SUPERVISOR' && user.zoneId ? `zone:${user.zoneId}` : 'all');
  }

  /** Envía a administradores y a los supervisores de la zona indicada. */
  emit(event: 'location' | 'route' | 'attempt' | 'alert', zoneId: string | null, payload: unknown) {
    if (!this.server) return;
    const rooms = zoneId ? ['all', `zone:${zoneId}`] : ['all'];
    this.server.to(rooms).emit(event, payload);
  }
}
