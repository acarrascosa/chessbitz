import type { Lang } from './ui';

interface Guide {
    title: string;
    lead: string;
    stepsTitle: string;
    steps: { title: string; text: string }[];
    coloursTitle: string;
    colours: { emoji: string; title: string; text: string }[];
    modesTitle: string;
    modes: { title: string; text: string }[];
    tipsTitle: string;
    tips: { title: string; text: string }[];
    faqTitle: string;
    faq: { q: string; a: string }[];
    numbersTitle: string;
    numbers: { openings: string; languages: string; plays: string; days: string };
    cta: string;
}

/** Long-form content of the "how to play" page, also the FAQ structured data. */
export const guide: Record<Lang, Guide> = {
    es: {
        title: 'Cómo se juega a Chessbitz',
        lead: 'Chessbitz es un reto diario de aperturas de ajedrez. Cada día hay una apertura clásica nueva: la juegas en el tablero jugada a jugada, con un número limitado de errores y pistas si te atascas, y al terminar entiendes por qué se juega así.',
        stepsTitle: 'El reto diario, paso a paso',
        steps: [
            { title: 'Lee el nombre de la apertura', text: 'Arriba ves el nombre, el código ECO, la dificultad y cuántas jugadas tienes que encontrar. Juegas con el bando que da nombre a la apertura: negras en la Siciliana, blancas en la Española.' },
            { title: 'Juega tus jugadas', text: 'Arrastra la pieza o toca origen y destino. Tu rival responde solo con la jugada de la línea. Los puntos del tablero marcan las casillas legales de la pieza elegida.' },
            { title: 'Cuidado con los errores', text: 'Una jugada legal que no es la de la línea cuenta como error y tienes 5 por reto. Las jugadas ilegales no cuentan: simplemente no se hacen.' },
            { title: 'Pide pistas si te atascas', text: 'Hay tres niveles por jugada: qué pieza mover, desde qué casilla y, por último, la flecha con la jugada. La primera pista de una jugada suma medio error y la flecha otro medio, así que una jugada revelada entera cuenta como un error. Las pistas nunca terminan el reto: aprende con ellas todo lo que quieras.' },
            { title: 'Descubre la teoría', text: 'Al terminar se desbloquean el modo estudio, con una explicación para cada jugada y las ideas de la apertura, y tres tácticas reales de esa apertura.' },
        ],
        coloursTitle: 'Qué significa cada color',
        colours: [
            { emoji: '🟩', title: 'A la primera', text: 'Encontraste la jugada sin pistas ni errores.' },
            { emoji: '🟨', title: 'Con ayuda', text: 'La encontraste después de un error o usando alguna pista.' },
            { emoji: '🟥', title: 'Revelada', text: 'Usaste la última pista (la flecha) o te quedaste sin errores.' },
        ],
        modesTitle: 'Más formas de jugar',
        modes: [
            { title: 'Archivo', text: 'Todos los retos anteriores están en el archivo. Puedes buscarlos por nombre o código ECO, filtrarlos por color y familia, o pedir uno al azar. No cuentan para tu racha.' },
            { title: 'Modo experto', text: 'Inspirado en Wordle: juegas todas tus jugadas sin ayuda y las envías juntas. Cada jugada recibe un color: verde si es exacta, amarillo si la pieza es correcta pero no la jugada, marrón si la casilla es correcta con otra pieza y gris si no acierta nada. Tienes 6 intentos. Si te sales de la línea, tu rival responde con un pequeño motor de ajedrez.' },
            { title: 'Tácticas', text: 'Cada apertura trae tres problemas tácticos de partidas reales jugadas en ella, sacados de la base de datos abierta de Lichess. Son la mejor forma de ver para qué sirven las ideas que acabas de aprender.' },
            { title: 'Batalla', text: 'Crea una mesa, comparte el enlace y jugad de 2 a 4 amigos los mismos problemas de Lichess a la vez. Elige partida corta (≈2 min, fáciles), normal (hasta 4 min, fáciles y difíciles) o larga (≈10 min, exigentes): cada tablero tiene un reloj según su dificultad y 5 errores. Resolver da 100 puntos, hasta 50 más por rapidez, −15 por cada error y −5 por cada pista.' },
        ],
        tipsTitle: 'Consejos',
        tips: [
            { title: 'Piensa en el nombre', text: 'El nombre suele contar la idea: un «gambito» entrega material, un «fianchetto» lleva el alfil a g2 o b2 y una «defensa» la eligen las negras.' },
            { title: 'Desarrolla y controla el centro', text: 'Si dudas, casi siempre es una jugada que saca una pieza menor, empuja un peón central o prepara el enroque.' },
            { title: 'Usa la primera pista sin miedo', text: 'Saber qué pieza se mueve suele bastar para recordar la línea: la jugada queda 🟨 y cuesta medio error, la mitad que equivocarse.' },
            { title: 'Estudia después de jugar', text: 'Las explicaciones jugada a jugada y la táctica fijan la apertura mucho mejor que repetirla de memoria.' },
            { title: 'Vuelve cada día', text: 'La racha solo sigue si completas el reto del día. Un error de más no pasa nada: mañana empieza otra.' },
        ],
        faqTitle: 'Preguntas frecuentes',
        faq: [
            { q: '¿Qué es Chessbitz?', a: 'Un juego diario de ajedrez en el que juegas los movimientos de una apertura clásica. Hay 366 aperturas, una por día durante un año, cada una con nombre, descripción, ideas estratégicas y una explicación para cada jugada.' },
            { q: '¿Necesito una cuenta?', a: 'No. Es gratis, sin registro y sin publicidad. Tu progreso se guarda en tu navegador y puedes llevarlo a otro dispositivo desde Ajustes con un archivo o un código.' },
            { q: '¿Puedo jugar contra mis amigos?', a: 'Sí, en Batalla: crea una mesa, comparte el enlace o el código de cuatro letras y, cuando todos estén listos, el anfitrión empieza. Todos jugáis los mismos tableros y gana quien más puntos sume. No hace falta cuenta.' },
            { q: '¿A qué hora cambia la apertura?', a: 'A medianoche en tu hora local. Todo el mundo juega la misma apertura en su día del calendario.' },
            { q: '¿Qué cuenta como error?', a: 'Una jugada legal que no es la de la línea. Las jugadas ilegales no cuentan. Las pistas suman medio error por jugada (uno si llegas a la flecha). Con 5 jugadas equivocadas el reto termina y se revela el resto de la línea; las pistas nunca lo terminan, pero si con ellas llegas a 5 errores, el reto cuenta como no resuelto.' },
            { q: '¿Cómo funcionan las estadísticas globales?', a: 'Al terminar el reto diario se envían de forma anónima tus errores, pistas y tiempo. Con eso se muestra cuántas personas han jugado, la distribución de errores y las medias del día.' },
            { q: '¿Qué es el modo experto?', a: 'Una forma de jugar cualquier día del archivo sin ayuda: juegas tus jugadas, las envías y recibes un color por jugada, como en Wordle. Tienes 6 intentos.' },
            { q: '¿De dónde salen las tácticas?', a: 'De la base de datos abierta de problemas de Lichess (licencia CC0), escogidas entre las partidas jugadas en cada apertura, con un nivel de entre 1000 y 1900.' },
            { q: '¿Puedo jugar sin conexión?', a: 'Sí. Chessbitz se puede instalar como app y, una vez visitado, la apertura del día sigue funcionando sin conexión.' },
        ],
        numbersTitle: 'Chessbitz en números',
        numbers: { openings: 'aperturas explicadas', languages: 'idiomas', plays: 'retos jugados', days: 'días con partidas' },
        cta: 'Jugar el reto de hoy',
    },
    en: {
        title: 'How to play Chessbitz',
        lead: 'Chessbitz is a daily chess opening challenge. Every day brings a new classic opening: you play it on the board move by move, with a limited number of mistakes and hints when you get stuck, and when you finish you understand why it is played that way.',
        stepsTitle: 'The daily challenge, step by step',
        steps: [
            { title: 'Read the opening name', text: 'At the top you see the name, the ECO code, the difficulty and how many moves you have to find. You play the side the opening is named after: black in the Sicilian, white in the Ruy Lopez.' },
            { title: 'Play your moves', text: "Drag the piece or tap from and to. Your opponent replies on its own with the line's move. The dots on the board show the legal squares of the selected piece." },
            { title: 'Watch your mistakes', text: "A legal move that isn't the move from the line counts as a mistake, and you have 5 per challenge. Illegal moves don't count: they are simply not played." },
            { title: 'Ask for hints when stuck', text: 'There are three levels per move: which piece, from which square and, finally, the arrow with the move. The first hint on a move adds half a mistake and the arrow another half, so a move given away entirely counts as one mistake. Hints never end the challenge: learn with them as much as you like.' },
            { title: 'Learn the theory', text: 'When you finish you unlock study mode, with an explanation for every move and the ideas behind the opening, plus three real tactics from that opening.' },
        ],
        coloursTitle: 'What each colour means',
        colours: [
            { emoji: '🟩', title: 'First try', text: 'You found the move without hints or mistakes.' },
            { emoji: '🟨', title: 'With help', text: 'You found it after a mistake or with a hint.' },
            { emoji: '🟥', title: 'Revealed', text: 'You used the last hint (the arrow) or ran out of mistakes.' },
        ],
        modesTitle: 'More ways to play',
        modes: [
            { title: 'Archive', text: "Every past challenge lives in the archive. Search by name or ECO code, filter by colour and family, or ask for a random one. They don't count towards your streak." },
            { title: 'Expert mode', text: "Inspired by Wordle: you play all your moves without help and submit them together. Every move gets a colour: green if exact, yellow if the piece is right but not the move, brown if the square is right with another piece and grey if neither. You have 6 attempts. If you leave the line, your opponent answers with a small chess engine." },
            { title: 'Tactics', text: "Every opening comes with three tactical puzzles from real games played in it, taken from the Lichess open database. They're the best way to see what the ideas you just learned are for." },
            { title: 'Battle', text: 'Create a table, share the link and race 1 to 3 friends through the same Lichess puzzles. Pick a short (≈2 min, easy), normal (up to 4 min, easy and hard) or long match (≈10 min, tough): each board has a clock that depends on its difficulty and 5 mistakes. Solving scores 100 points, up to 50 more for speed, −15 per mistake and −5 per hint.' },
        ],
        tipsTitle: 'Tips',
        tips: [
            { title: 'Think about the name', text: 'The name often tells the idea: a "gambit" gives up material, a "fianchetto" puts the bishop on g2 or b2 and a "defence" is chosen by black.' },
            { title: 'Develop and control the centre', text: "When in doubt, it's almost always a move that develops a minor piece, pushes a central pawn or prepares castling." },
            { title: 'Use the first hint freely', text: 'Knowing which piece moves is often enough to recall the line: the move turns 🟨 and costs half a mistake, half as much as getting it wrong.' },
            { title: 'Study after playing', text: 'The move-by-move explanations and the tactic make the opening stick far better than repeating it by heart.' },
            { title: 'Come back every day', text: "Your streak only continues if you complete the day's challenge. One mistake too many is fine: tomorrow brings another." },
        ],
        faqTitle: 'Frequently asked questions',
        faq: [
            { q: 'What is Chessbitz?', a: 'A daily chess game where you play the moves of a classic opening. There are 366 openings, one per day for a year, each with a name, description, strategic ideas and an explanation for every move.' },
            { q: 'Do I need an account?', a: "No. It's free, with no sign-up and no ads. Your progress is stored in your browser, and you can move it to another device from Settings with a file or a code." },
            { q: 'Can I play against my friends?', a: "Yes, in Battle: create a table, share the link or the four-letter code and, once everyone's ready, the host starts. You all play the same boards and whoever scores the most wins. No account needed." },
            { q: 'When does the opening change?', a: 'At midnight in your local time. Everyone plays the same opening on their calendar day.' },
            { q: 'What counts as a mistake?', a: "A legal move that isn't the move from the line. Illegal moves don't count. Hints add half a mistake per move (a whole one if you get to the arrow). After 5 wrong moves the challenge ends and the rest of the line is revealed; hints never end it, but if they take you to 5 mistakes the challenge counts as not solved." },
            { q: 'How do the global statistics work?', a: "When you finish the daily challenge, your mistakes, hints and time are sent anonymously. That's how the site shows how many people played, the mistake distribution and the day's averages." },
            { q: 'What is expert mode?', a: 'A way to play any archive day without help: play your moves, submit them and get a colour per move, like Wordle. You have 6 attempts.' },
            { q: 'Where do the tactics come from?', a: 'From the Lichess open puzzle database (CC0 licence), picked from games played in each opening, rated between 1000 and 1900.' },
            { q: 'Can I play offline?', a: "Yes. Chessbitz can be installed as an app and, once visited, today's opening keeps working offline." },
        ],
        numbersTitle: 'Chessbitz in numbers',
        numbers: { openings: 'openings explained', languages: 'languages', plays: 'challenges played', days: 'days with games' },
        cta: "Play today's challenge",
    },
};
