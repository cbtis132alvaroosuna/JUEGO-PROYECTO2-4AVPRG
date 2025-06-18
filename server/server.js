const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Variables del juego
let jugadores = [];
let palabrasPorJugador = {};
let votos = {};
let impostorId = null;
let tema = "";
let categoria = "";
let temporizadorEscritura = null;
let temporizadorVotacion = null;
let faseActual = "registro";

const TIEMPO_ESCRITURA = 40000; // 40 segundos
const TIEMPO_VOTACION = 40000; // 40 segundos

const tematicas = [
  { categoria: "Casa", tema: "Cama" },
  { categoria: "Comida", tema: "Dulces" },
  { categoria: "Transporte", tema: "Carro" },
  { categoria: "Tecnología", tema: "Computadora" },
  { categoria: "Ropa", tema: "Zapatos" },
];

io.on('connection', (socket) => {
  console.log(`Jugador conectado: ${socket.id}`);

  socket.on('registrarse', ({ nombre, apodo }) => {
    if (jugadores.length >= 4) {
      socket.emit('error', 'La partida ya está llena (4 jugadores)');
      return;
    }
    
    if (jugadores.some(j => j.apodo === apodo)) {
      socket.emit('error', 'Ese apodo ya está en uso');
      return;
    }
    
    const nuevoJugador = { id: socket.id, nombre, apodo };
    jugadores.push(nuevoJugador);
    actualizarJugadores();
    socket.emit('registro-exitoso');

    if (jugadores.length === 4) {
      iniciarRonda();
    }
  });

  socket.on('palabra', (texto) => {
    if (faseActual !== "escritura") return;
    
    palabrasPorJugador[socket.id] = texto.trim() || "[Sin respuesta]";
    actualizarJugadores();
    
    if (Object.keys(palabrasPorJugador).length === jugadores.length) {
      clearTimeout(temporizadorEscritura);
      iniciarVotacion();
    }
  });

  socket.on('votar', (idVotado) => {
    if (faseActual !== "votacion") return;
    
    if (!jugadores.some(j => j.id === idVotado)) {
      socket.emit('error', 'Jugador no válido');
      return;
    }
    
    votos[socket.id] = idVotado;
    actualizarJugadores();
    
    if (Object.keys(votos).length === jugadores.length) {
      clearTimeout(temporizadorVotacion);
      calcularResultado();
    }
  });

  socket.on('reiniciar', () => {
    if (jugadores.length === 4) {
      iniciarRonda();
    }
  });

  socket.on('disconnect', () => {
    console.log(`Jugador desconectado: ${socket.id}`);
    jugadores = jugadores.filter((j) => j.id !== socket.id);
    actualizarJugadores();
    
    if (jugadores.length < 4 && (faseActual === "escritura" || faseActual === "votacion")) {
      reiniciarJuego();
      io.emit('error', 'Partida cancelada por desconexión');
      io.emit('fase', 'esperando');
    }
  });
});

function iniciarRonda() {
  const seleccion = tematicas[Math.floor(Math.random() * tematicas.length)];
  categoria = seleccion.categoria;
  tema = seleccion.tema;
  
  reiniciarJuego();
  impostorId = jugadores[Math.floor(Math.random() * jugadores.length)].id;
  faseActual = "escritura";

  jugadores.forEach((j) => {
    io.to(j.id).emit('asignacion', { 
      categoria, 
      tema: j.id === impostorId ? null : tema 
    });
  });

  io.emit('fase', 'escritura');
  
  temporizadorEscritura = setTimeout(() => {
    if (faseActual === "escritura") {
      jugadores.forEach(j => {
        if (!palabrasPorJugador[j.id]) {
          palabrasPorJugador[j.id] = "[Sin respuesta]";
        }
      });
      iniciarVotacion();
    }
  }, TIEMPO_ESCRITURA);
}

function iniciarVotacion() {
  faseActual = "votacion";
  io.emit('palabras-listas', palabrasPorJugador);
  io.emit('fase', 'votacion');
  
  temporizadorVotacion = setTimeout(() => {
    if (faseActual === "votacion") {
      jugadores.forEach(j => {
        if (!votos[j.id]) {
          votos[j.id] = jugadores[0].id;
        }
      });
      calcularResultado();
    }
  }, TIEMPO_VOTACION);
}

function calcularResultado() {
  faseActual = "resultado";
  const conteo = {};
  Object.values(votos).forEach((v) => {
    conteo[v] = (conteo[v] || 0) + 1;
  });

  const expulsado = Object.keys(conteo).reduce((a, b) =>
    conteo[a] > conteo[b] ? a : b
  );

  const ganoImpostor = expulsado !== impostorId;
  const jugadorExpulsado = jugadores.find((j) => j.id === expulsado);
  const jugadorImpostor = jugadores.find((j) => j.id === impostorId);

  io.emit('resultado', {
    expulsado: jugadorExpulsado?.apodo || "Desconocido",
    impostor: jugadorImpostor?.apodo || "Desconocido",
    impostorId,
    ganoImpostor,
    palabras: palabrasPorJugador,
    temaReal: tema,
    categoria
  });

  io.emit('fase', 'resultado');
}

function reiniciarJuego() {
  palabrasPorJugador = {};
  votos = {};
  faseActual = "esperando";
  if (temporizadorEscritura) clearTimeout(temporizadorEscritura);
  if (temporizadorVotacion) clearTimeout(temporizadorVotacion);
}

function actualizarJugadores() {
  io.emit('jugadores', jugadores);
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});