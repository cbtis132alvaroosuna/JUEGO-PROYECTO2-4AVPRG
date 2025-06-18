import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const socket = io(`http://${window.location.hostname}:3000`);

function App() {
  const [fase, setFase] = useState('registro');
  const [nombre, setNombre] = useState('');
  const [apodo, setApodo] = useState('');
  const [jugadores, setJugadores] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [tema, setTema] = useState('');
  const [palabra, setPalabra] = useState('');
  const [palabrasRecibidas, setPalabrasRecibidas] = useState({});
  const [voto, setVoto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [temporizador, setTemporizador] = useState(40);
  const [error, setError] = useState('');
  const intervaloRef = useRef(null);

  useEffect(() => {
    socket.on('error', (mensaje) => {
      setError(mensaje);
      setTimeout(() => setError(''), 5000);
    });

    socket.on('jugadores', (listaJugadores) => {
      setJugadores(listaJugadores);
    });
    
    socket.on('registro-exitoso', () => {
      setFase('esperando');
    });
    
    socket.on('asignacion', ({ categoria, tema }) => {
      setCategoria(categoria);
      setTema(tema);
      setFase('escritura');
      setPalabra('');
      iniciarTemporizador(40);
    });
    
    socket.on('palabras-listas', (palabras) => {
      setPalabrasRecibidas(palabras);
      setFase('votacion');
      iniciarTemporizador(40);
    });
    
    socket.on('resultado', (res) => {
      setResultado(res);
      setFase('resultado');
      clearInterval(intervaloRef.current);
    });

    return () => {
      socket.off();
      clearInterval(intervaloRef.current);
    };
  }, []);

  const iniciarTemporizador = (segundos) => {
    clearInterval(intervaloRef.current);
    setTemporizador(segundos);
    
    intervaloRef.current = setInterval(() => {
      setTemporizador(prev => {
        if (prev <= 1) {
          clearInterval(intervaloRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const registrarse = () => {
    if (nombre && apodo) {
      socket.emit('registrarse', { nombre, apodo });
    }
  };

  const enviarPalabra = () => {
    socket.emit('palabra', palabra.trim());
    setFase('esperando');
  };

  const enviarVoto = () => {
    if (voto) {
      socket.emit('votar', voto);
      setFase('esperando');
    }
  };

  const reiniciar = () => {
    socket.emit('reiniciar');
    setResultado(null);
    setPalabra('');
    setVoto('');
  };

  return (
    <div className="container text-center">
      <img src="/logo.jpg" alt="logo" className="logo" />
      <h1 className="my-3">🎭 Juego del Impostor</h1>

      {error && <div className="alert alert-danger">{error}</div>}

      {fase === 'registro' && (
        <div className="registro-form">
          <input
            className="form-control mb-2"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="form-control mb-2"
            placeholder="Apodo (visible para otros)"
            value={apodo}
            onChange={(e) => setApodo(e.target.value)}
          />
          <button 
            className="btn btn-primary" 
            onClick={registrarse}
            disabled={!nombre || !apodo}
          >
            Registrarse
          </button>
        </div>
      )}

      {(fase === 'registro' || fase === 'esperando') && (
        <div className="mt-4 jugadores-container">
          <h5>👥 Jugadores conectados ({jugadores.length}/4):</h5>
          <ul className="list-group">
            {jugadores.map((j) => (
              <li key={j.id} className="list-group-item">
                <span className="jugador-apodo">{j.apodo}</span>
                <span className="jugador-nombre">({j.nombre})</span>
              </li>
            ))}
          </ul>
          {fase === 'esperando' && jugadores.length < 4 && (
            <p className="mt-3 esperando-text">
              ⏳ Esperando a {4 - jugadores.length} jugador(es) más...
            </p>
          )}
        </div>
      )}

      {fase === 'escritura' && (
        <div className="escritura-container">
          <h3>Categoría: <span className="categoria-text">{categoria}</span></h3>
          <h4 className={!tema ? "impostor-theme" : ""}>
            {tema ? `Temática: ${tema}` : "❓ Eres el impostor, adivina el tema"}
          </h4>
          <p className="temporizador">⏱ Tiempo restante: {temporizador}s</p>
          <input
            className="form-control my-3 palabra-input"
            placeholder={tema ? "Escribe una palabra relacionada" : "Adivina el tema y escribe una palabra"}
            value={palabra}
            onChange={(e) => setPalabra(e.target.value)}
            autoFocus
          />
          <button 
            className="btn btn-success enviar-btn"
            onClick={enviarPalabra}
          >
            Enviar palabra
          </button>
        </div>
      )}

      {fase === 'votacion' && (
        <div className="votacion-container">
          <h3>Palabras de los jugadores:</h3>
          <p className="instruccion-voto">Vota por quién crees que es el impostor</p>
          <p className="temporizador">⏱ Tiempo restante: {temporizador}s</p>
          
          <ul className="list-group palabras-list">
            {jugadores.map((jugador) => (
              <li 
                key={jugador.id} 
                className={`list-group-item ${voto === jugador.id ? 'voto-seleccionado' : ''}`}
              >
                <div className="palabra-jugador">
                  <strong>{jugador.apodo}:</strong> 
                  <span className={`palabra-text ${!palabrasRecibidas[jugador.id] || palabrasRecibidas[jugador.id] === "[Sin respuesta]" ? 'vacia' : ''}`}>
                    {palabrasRecibidas[jugador.id] || "No envió palabra"}
                  </span>
                </div>
                <button
                  className={`btn btn-sm votar-btn ${voto === jugador.id ? 'btn-danger' : 'btn-outline-danger'}`}
                  onClick={() => setVoto(jugador.id)}
                >
                  {voto === jugador.id ? '✓ Votado' : 'Votar'}
                </button>
              </li>
            ))}
          </ul>
          
          <button 
            className="btn btn-primary enviar-voto-btn mt-3"
            onClick={enviarVoto}
            disabled={!voto}
          >
            {voto ? `Confirmar voto por ${jugadores.find(j => j.id === voto)?.apodo}` : 'Selecciona un jugador'}
          </button>
        </div>
      )}

      {fase === 'resultado' && resultado && (
        <div className="resultado-container">
          <div className="resultado-card">
            <h3>Resultado Final</h3>
            
            <div className="resultado-info">
              <p><strong>Expulsado:</strong> {resultado.expulsado}</p>
              <p><strong>Impostor:</strong> {resultado.impostor}</p>
              <p><strong>Categoría:</strong> {resultado.categoria}</p>
              <p><strong>Tema real:</strong> {resultado.temaReal}</p>
            </div>
            
            <h4 className={`resultado-final ${resultado.ganoImpostor ? 'impostor-gano' : 'impostor-perdio'}`}>
              {resultado.ganoImpostor
                ? "😈 ¡El impostor ganó!"
                : "🎉 ¡Atraparon al impostor!"}
            </h4>
            
            <div className="palabras-resultado">
              <h5>Palabras enviadas:</h5>
              <ul className="list-group">
                {jugadores.map((jugador) => (
                  <li key={jugador.id} className="list-group-item">
                    <strong>{jugador.apodo}:</strong> {resultado.palabras[jugador.id]}
                    {jugador.id === resultado.impostorId && " 👿"}
                  </li>
                ))}
              </ul>
            </div>
            
            {jugadores.length === 4 && (
              <button 
                className="btn btn-secondary reiniciar-btn mt-3"
                onClick={reiniciar}
              >
                Jugar otra vez
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;