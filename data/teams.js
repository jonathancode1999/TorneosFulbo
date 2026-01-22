/*
  Listado precargado de ligas y equipos.
  Podés editar este listado desde la pantalla "Equipos y ligas".
  Nota: ascensos/descensos pueden cambiar con el tiempo.
*/

window.DEFAULT_LEAGUES = [
  {
    id: 'ar',
    name: 'Liga Argentina (Primera División)',
    region: 'LATAM',
    teams: [
      'Aldosivi','Argentinos Juniors','Atlético Tucumán','Barracas Central','Banfield','Belgrano',
      'Boca Juniors','Central Córdoba (SdE)','Defensa y Justicia','Deportivo Riestra','Estudiantes (LP)','Gimnasia (LP)',
      'Godoy Cruz','Huracán','Independiente','Independiente Rivadavia','Instituto','Lanús','Newell\'s Old Boys','Platense',
      'Racing Club','River Plate','Rosario Central','San Lorenzo','San Martín (SJ)','Sarmiento (Junín)','Talleres (Córdoba)',
      'Tigre','Unión (Santa Fe)','Vélez Sarsfield'
    ]
  },
  {
    id: 'br',
    name: 'Brasil (Série A)',
    region: 'LATAM',
    teams: [
      'Atlético Mineiro','Bahia','Botafogo','Ceará','Corinthians','Cruzeiro','Flamengo','Fluminense','Fortaleza','Grêmio',
      'Internacional','Juventude','Mirassol','Palmeiras','Red Bull Bragantino','Santos','São Paulo','Sport','Vasco da Gama','Vitória'
    ]
  },
  {
    id: 'uy',
    name: 'Uruguay (Primera División)',
    region: 'LATAM',
    teams: [
      'Nacional','Peñarol','Defensor Sporting','Liverpool','Danubio','Montevideo Wanderers','Racing','Boston River',
      'Cerro Largo','Cerro','Montevideo City Torque','Progreso','River Plate (URU)','Miramar Misiones','Plaza Colonia','Juventud'
    ]
  },
  {
    id: 'cl',
    name: 'Chile (Primera División)',
    region: 'LATAM',
    teams: [
      'Audax Italiano','Cobresal','Colo-Colo','Coquimbo Unido','Deportes Iquique','Deportes La Serena','Deportes Limache','Everton',
      'Huachipato','Ñublense','O\'Higgins','Palestino','Unión Española','Unión La Calera','Universidad Católica','Universidad de Chile'
    ]
  },
  {
    id: 'pe',
    name: 'Perú (Liga 1)',
    region: 'LATAM',
    teams: [
      'ADT','Alianza Atlético','Alianza Lima','Alianza Universidad','Atlético Grau','Ayacucho','Binacional','Cienciano','Comerciantes Unidos',
      'Cusco','Deportivo Garcilaso','Juan Pablo II College','Los Chankas','Melgar','Sport Boys','Sport Huancayo','Sporting Cristal','UTC','Universitario'
    ]
  },
  {
    id: 'co',
    name: 'Colombia (Categoría Primera A)',
    region: 'LATAM',
    teams: [
      'Atlético Nacional','Millonarios','América de Cali','Independiente Medellín','Junior','Independiente Santa Fe','Deportes Tolima','Once Caldas',
      'Deportivo Cali','La Equidad','Águilas Doradas','Atlético Bucaramanga','Boyacá Chicó','Alianza FC','Deportivo Pasto','Envigado',
      'Fortaleza CEIF','Jaguares de Córdoba','Unión Magdalena','Patriotas Boyacá'
    ]
  },
  {
    id: 'ec',
    name: 'Ecuador (Serie A)',
    region: 'LATAM',
    teams: [
      'Aucas','Barcelona','Delfín','Deportivo Cuenca','El Nacional','Emelec','Independiente del Valle','LDU Quito','Libertad','Macará','Manta',
      'Mushuc Runa','Orense','Técnico Universitario','Universidad Católica','Vinotinto Ecuador'
    ]
  },
  {
    id: 'mx',
    name: 'México (Liga MX)',
    region: 'LATAM',
    teams: [
      'América','Atlas','Atlético San Luis','Cruz Azul','Guadalajara (Chivas)','FC Juárez','León','Mazatlán','Monterrey','Necaxa','Pachuca','Puebla',
      'Pumas UNAM','Querétaro','Santos Laguna','Tigres UANL','Tijuana','Toluca'
    ]
  },

  // EUROPA
  {
    id: 'es',
    name: 'España (La Liga)',
    region: 'EUROPA',
    teams: [
      'Athletic Club','Atlético de Madrid','Osasuna','Celta de Vigo','Deportivo Alavés','Elche','Barcelona','Getafe','Girona','Mallorca',
      'Rayo Vallecano','Real Betis','Real Madrid','Real Sociedad','Sevilla','Valencia','Villarreal','Levante','Espanyol','Real Oviedo'
    ]
  },
  {
    id: 'it',
    name: 'Italia (Serie A)',
    region: 'EUROPA',
    teams: [
      'Atalanta','Bologna','Cagliari','Como','Empoli','Fiorentina','Genoa','Inter','Juventus','Lazio','Lecce','Milan','Monza','Napoli',
      'Parma','Roma','Torino','Udinese','Venezia','Verona'
    ]
  },
  {
    id: 'en',
    name: 'Inglaterra (Premier League)',
    region: 'EUROPA',
    teams: [
      'Arsenal','Aston Villa','Bournemouth','Brentford','Brighton','Burnley','Chelsea','Crystal Palace','Everton','Fulham',
      'Leeds United','Liverpool','Manchester City','Manchester United','Newcastle United','Nottingham Forest','Sunderland','Tottenham Hotspur','West Ham United','Wolverhampton Wanderers'
    ]
  },
  {
    id: 'de',
    name: 'Alemania (Bundesliga)',
    region: 'EUROPA',
    teams: [
      'Bayern Munich','Borussia Dortmund','Bayer Leverkusen','RB Leipzig','Eintracht Frankfurt','SC Freiburg','VfB Stuttgart','VfL Wolfsburg',
      'Borussia Mönchengladbach','Union Berlin','Werder Bremen','FC Augsburg','TSG Hoffenheim','Mainz 05','Heidenheim','Hamburger SV','1. FC Köln','St. Pauli'
    ]
  },
  {
    id: 'fr',
    name: 'Francia (Ligue 1)',
    region: 'EUROPA',
    teams: [
      'Paris Saint-Germain','Marseille','Lyon','Monaco','Lille','Nice','Rennes','Lens','Strasbourg','Nantes','Toulouse','Montpellier','Brest',
      'Reims','Angers','Lorient','Metz','Auxerre'
    ]
  },
  {
    id: 'pt',
    name: 'Portugal (Primeira Liga)',
    region: 'EUROPA',
    teams: [
      'Benfica','Porto','Sporting CP','Braga','Vitória de Guimarães','Gil Vicente','Famalicão','Boavista','Estoril','Arouca','Rio Ave','Casa Pia',
      'Moreirense','Farense','Nacional','Tondela','AVS','Santa Clara'
    ]
  }
];
