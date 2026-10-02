// Punto de entrada. La tarea de ubicación en segundo plano DEBE definirse en el ámbito
// global, antes de montar cualquier pantalla, para que el sistema operativo pueda
// despertarla aunque la interfaz no esté abierta.
import './src/location/task';
import 'expo-router/entry';
