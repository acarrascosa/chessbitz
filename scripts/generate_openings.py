
import json
import random
import os

# Helper to create consistent opening objects
def create_opening(eco, name, pgn, fen, name_es, desc_es, desc_en):
    return {
        "eco": eco,
        "name": name,
        "pgn": pgn,
        "fen": fen,
        "content": {
            "es": {
                "name": name_es,
                "description": desc_es,
                "explanations": ["Desarrollo estándar.", "Control del centro.", "Una jugada clave.", "Prepara el enroque."] 
            },
            "en": {
                "name": name,
                "description": desc_en,
                "explanations": ["Standard development.", "Center control.", "A key move.", "Prepares castling."]
            }
        },
        "family": name.split(":")[0].split(" ")[0] # heuristic for grouping
    }

new_openings_data = []

new_openings_data.extend([
    ("C50", "Italian Game", "1. e4 e5 2. Nf3 Nc6 3. Bc4", "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", 
     "Apertura Italiana", "Una apertura clásica y directa que busca controlar el centro rápidamente.", "A classic, direct opening aiming to control the center quickly."),
    ("C55", "Two Knights Defense", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6", "r1bqkb1r/pppp1ppp/2n2n2/2b5/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 4",
     "Defensa de los Dos Caballos", "Un contraataque agresivo donde las negras ignoran la amenaza sobre e5.", "An aggressive counter-attack where Black ignores the threat on e5."),
    ("C42", "Petrov's Defense", "1. e4 e5 2. Nf3 Nf6", "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
     "Defensa Petrov", "Una defensa sólida y simétrica, ideal para tablas pero con veneno.", "A solid, symmetrical defense, often used to draw but contains traps."),
    ("C41", "Philidor Defense", "1. e4 e5 2. Nf3 d6", "rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
     "Defensa Philidor", "Sólida pero algo pasiva, las negras protegen el centro con peones.", "Solid but slightly passive, Black protects the center with pawns."),
    ("C45", "Scotch Game", "1. e4 e5 2. Nf3 Nc6 3. d4", "r1bqkbnr/pppp1ppp/2n5/3Pp3/4P3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3",
     "Apertura Escocesa", "Las blancas abren el centro inmediatamente. Muy dinámica.", "White opens the center immediately. Very dynamic."),
    ("C47", "Four Knights Game", "1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6", "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4",
     "Apertura de los Cuatro Caballos", "Tranquila y posicional, lleva a juegos igualados.", "Quiet and positional, leads to balanced games."),
    ("C26", "Vienna Game", "1. e4 e5 2. Nc3", "rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2",
     "Apertura Vienesa", "Las blancas desarrollan el caballo de dama primero para mantener la opción de f4.", "White develops the queenside knight first to keep the f4 option open."),
    ("C30", "King's Gambit", "1. e4 e5 2. f4", "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq - 0 2",
     "Gambito de Rey", "Romántica y arriesgada, las blancas sacrifican un peón por ataque.", "Romantic and risky, White sacrifices a pawn for attack."),
    ("C21", "Center Game", "1. e4 e5 2. d4", "rnbqkbnr/pppp1ppp/8/3Pp3/4P3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
     "Apertura del Centro", "Las blancas desafían el centro inmediatamente, liberando sus piezas.", "White challenges the center immediately, freeing their pieces."),
    ("C23", "Bishop's Opening", "1. e4 e5 2. Bc4", "rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2",
     "Apertura del Alfil", "Apunta al punto débil f7 desde el principio.", "Targets the weak f7 square from the start."),
    ("C20", "Alapin's Opening", "1. e4 e5 2. Ne2", "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPPNPPP/RNBQKB1R b KQkq - 1 2",
     "Apertura Alapin", "Una rareza posicional preparando f4 o d4.", "A positional oddity preparing f4 or d4."),
    ("C44", "Ponziani Opening", "1. e4 e5 2. Nf3 Nc6 3. c3", "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3",
     "Apertura Ponziani", "Busca construir un fuerte centro de peones con d4.", "Seeks to build a strong pawn center with d4."),
    ("C00", "French Defense", "1. e4 e6", "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
     "Defensa Francesa", "Sólida y contundente, las negras luchan por d5.", "Solid and punchy, Black fights for d5."),
    ("B10", "Caro-Kann Defense", "1. e4 c6", "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
     "Defensa Caro-Kann", "Extremadamente sólida, similar a la francesa pero con el alfil de casillas claras libre.", "Extremely solid, similar to the French but with the light-squared bishop free."),
    ("B07", "Pirc Defense", "1. e4 d6 2. d4 Nf6", "rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 1 3",
     "Defensa Pirc", "Las negras permiten a las blancas ocupar el centro para minarlo después.", "Black allows White to occupy the center to undermine it later."),
    ("B06", "Modern Defense", "1. e4 g6", "rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
     "Defensa Moderna", "Hipermoderna, fianchettando el alfil de rey rápidamente.", "Hypermodern, fianchettoing the king's bishop quickly."),
    ("B02", "Alekhine's Defense", "1. e4 Nf6", "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",
     "Defensa Alekhine", "Provoca a los peones blancos a avanzar para convertirlos en debilidades.", "Provokes white pawns to advance to turn them into weaknesses."),
    ("B01", "Scandinavian Defense", "1. e4 d5", "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
     "Defensa Escandinava", "Desafía el centro inmediatamente, a menudo llevando a la reina al juego pronto.", "Challenges the center immediately, often bringing the queen out early."),
    ("B00", "Nimzowitsch Defense", "1. e4 Nc6", "r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",
     "Defensa Nimzowitsch", "Una respuesta poco convencional que controla d4.", "An unconventional response controlling d4.")
])


new_openings_data.extend([
    # Closed Games
    ("D10", "Slav Defense", "1. d4 d5 2. c4 c6", "rnbqkbnr/pp1ppppp/2p5/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
     "Defensa Eslava", "Una de las respuestas más sólidas al Gambito de Dama. Soporta el centro sin bloquear el alfil.", "One of the most solid responses to the Queen's Gambit. Supports the center without blocking the bishop."),
    ("D30", "Queen's Gambit Declined", "1. d4 d5 2. c4 e6", "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
     "Gambito de Dama Rehusado", "La forma clásica de rechazar el gambito, priorizando la solidez.", "The classic way to decline the gambit, prioritizing solidity."),
    ("D20", "Queen's Gambit Accepted", "1. d4 d5 2. c4 dxc4", "rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
     "Gambito de Dama Aceptado", "Las negras toman el peón para acelerar el desarrollo.", "Black takes the pawn to accelerate development."),
    ("D02", "London System", "1. d4 d5 2. Bf4", "rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2",
     "Sistema Londres", "Un sistema sólido y universal para las blancas, fácil de aprender.", "A solid, universal system for White, easy to learn."),
    ("D04", "Colle System", "1. d4 d5 2. Nf3 Nf6 3. e3", "rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq - 0 3",
     "Sistema Colle", "Sólido y modesto, buscando un ataque posterior en el flanco de rey.", "Solid and modest, aiming for a later kingside attack."),
    ("D00", "Trompowsky Attack", "1. d4 Nf6 2. Bg5", "rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2",
     "Ataque Trompowsky", "Agresiva y posicional, las blancas buscan desequilibrar la estructura de peones negra.", "Aggressive and positional, White looks to unbalance existing black pawn structure."),
    ("A80", "Dutch Defense", "1. d4 f5", "rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
     "Defensa Holandesa", "Un contraataque agresivo en el flanco de rey.", "An aggressive counter-attack on the kingside."),
    ("A40", "English Defense", "1. d4 e6 2. c4 b6", "rnbqkbnr/p1pp1ppp/1p2p3/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
     "Defensa Inglesa", "Una defensa hipermoderna permitiendo a las blancas tomar el centro.", "A hypermodern defense allowing White to take the center."),
    
    # Indian Defenses
    ("E60", "King's Indian Defense", "1. d4 Nf6 2. c4 g6", "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
     "Defensa India de Rey", "Dinámica y compleja, las negras permiten un centro fuerte para atacarlo después.", "Dynamic and complex, Black allows a strong center to attack it later."),
    ("E20", "Nimzo-Indian Defense", "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4", "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",
     "Defensa Nimzo-India", "Controla el centro con piezas, impidiendo e4.", "Controls the center with pieces, preventing e4."),
    ("E12", "Queen's Indian Defense", "1. d4 Nf6 2. c4 e6 3. Nf3 b6", "rnbqkb1r/p1pppppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 0 4",
     "Defensa India de Dama", "Controla las casillas blancas desde el flanco.", "Controls light squares from the flank."),
    ("D70", "Grunfeld Defense", "1. d4 Nf6 2. c4 g6 3. Nc3 d5", "rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4",
     "Defensa Grünfeld", "Las negras ceden el centro para atacarlo con piezas y peones.", "Black concedes the center to attack it with pieces and pawns."),
    ("A60", "Benoni Defense", "1. d4 Nf6 2. c4 c5 3. d5", "rnbqkb1r/pp1ppppp/5n2/2pP4/2P5/8/PP2PPPP/RNBQKBNR b KQkq - 0 3",
     "Defensa Benoni", "Crea un desequilibrio inmediato con mayorías de peones opuestas.", "Creates immediate imbalance with opposite pawn majorities."),
    ("A57", "Benko Gambit", "1. d4 Nf6 2. c4 c5 3. d5 b5", "rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq - 0 4",
     "Gambito Benko", "Sacrificio posicional de peón por presión duradera en el flanco de dama.", "Positional pawn sacrifice for lasting queenside pressure."),
    ("E11", "Bogo-Indian Defense", "1. d4 Nf6 2. c4 e6 3. Nf3 Bb4+", "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 2 4",
     "Defensa Bogo-India", "Una alternativa sólida a la India de Dama.", "A solid alternative to the Queen's Indian."),
    ("A46", "Torre Attack", "1. d4 Nf6 2. Nf3 e6 3. Bg5", "rnbqkb1r/pppp1ppp/4pn2/6B1/3P4/5N2/PPP1PPPP/RN1QKB1R b KQkq - 1 3",
     "Ataque Torre", "Sistema sólido similar al Trompowsky pero menos agresivo.", "Solid system similar to Trompowsky but less aggressive."),

    # Flank Openings
    ("A10", "English Opening", "1. c4", "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1",
     "Apertura Inglesa", "Controla d5 desde el flanco, a menudo transponiendo a líneas de d4.", "Controls d5 from the flank, often transposing to d4 lines."),
    ("A04", "Réti Opening", "1. Nf3", "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1",
     "Apertura Réti", "Hipermoderna, controlando el centro a distancia.", "Hypermodern, controlling the center from a distance."),
    ("A02", "Bird's Opening", "1. f4", "rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq - 0 1",
     "Apertura Bird", "Agresiva y arriesgada, busca controlar e5.", "Aggressive and risky, seeks to control e5."),
    ("A01", "Larsen's Opening", "1. b3", "rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR b KQkq - 0 1",
     "Apertura Larsen", "Desarrollo del alfil por fianchetto en el flanco de dama.", "Queenside fianchetto development."),
    ("A00", "Sokolsky Opening", "1. b4", "rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 1",
     "Apertura Sokolsky", "También llamada el Orangután, busca espacio en el flanco de dama.", "Also called the Orangutan, seeks queenside space."),
    ("A00", "Grob's Attack", "1. g4", "rnbqkbnr/pppppppp/8/8/6P1/8/PPPPPP1P/RNBQKBNR b KQkq - 0 1",
     "Ataque Grob", "Muy agresiva y excéntrica, debilitando el flanco de rey.", "Very aggressive and eccentric, weakening the kingside."),
    ("A07", "King's Indian Attack", "1. Nf3 d5 2. g3", "rnbqkbnr/ppp1pppp/8/3p4/8/5NP1/PPPPPP1P/RNBQKB1R b KQkq - 0 2",
     "Ataque Indio de Rey", "Sistema flexibile donde las blancas juegan como una India de Rey con colores cambiados.", "Flexible system where White plays like a reversed King's Indian.")
])


new_openings_data.extend([
    # Batch 3 - Variations
    ("B90", "Sicilian Defense: Najdorf", "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6", "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
     "Siciliana Najdorf", "La variante más popular y compleja de la Siciliana.", "The most popular and complex variation of the Sicilian."),
    ("B70", "Sicilian Defense: Dragon", "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6", "rnbqkb1r/pp2pp1p/3p1n2/6p1/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
     "Siciliana Dragón", "Agresiva, con fianchetto del alfil de rey negro.", "Aggressive, featuring a kingside fianchetto for Black."),
    ("B33", "Sicilian Defense: Sveshnikov", "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5", "r1bqkb1r/pp1p1ppp/2n2n2/4p3/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
     "Siciliana Sveshnikov", "Dinámica y posicional, las negras aceptan una debilidad en d5.", "Dynamic and positional, Black accepts a weakness on d5."),
    ("B23", "Sicilian Defense: Closed", "1. e4 c5 2. Nc3", "rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2",
     "Siciliana Cerrada", "Las blancas evitan d4 abierto y juegan posicionalmente.", "White avoids the open d4 and plays positionally."),
    ("B21", "Sicilian Defense: Grand Prix", "1. e4 c5 2. f4", "rnbqkbnr/pp1ppppp/8/2p5/4PP2/8/PPPP2PP/RNBQKBNR b KQkq - 0 2",
     "Siciliana Grand Prix", "Un ataque directo al flanco de rey negro.", "A direct attack on the black kingside."),
    ("C65", "Ruy Lopez: Berlin Defense", "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6", "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4",
     "Ruy Lopez: Muro de Berlín", "Famosa por su solidez de tablas.", "Famous for its drawing solidity."),
    ("C68", "Ruy Lopez: Exchange", "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6", "r1bqkbnr/1ppp1ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
     "Ruy Lopez: Variante del Cambio", "Las blancas cambian el alfil para doblar peones negros.", "White exchanges the bishop to double Black's pawns."),
    ("C89", "Ruy Lopez: Marshall Attack", "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5", "r1bq1rk1/2p1bppp/p1n2n2/1p1pp3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - - 0 9",
     "Ruy Lopez: Ataque Marshall", "Un sacrificio de peón legendario por ataque.", "A legendary pawn sacrifice for attack."),
    ("C02", "French Defense: Advance", "1. e4 e6 2. d4 d5 3. e5", "rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3",
     "Francesa: Variante del Avance", "Cierra el centro y gana espacio.", "Closes the center and gains space."),
    ("C01", "French Defense: Exchange", "1. e4 e6 2. d4 d5 3. exd5", "rnbqkbnr/ppp2ppp/4p3/3P4/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3",
     "Francesa: Variante del Cambio", "Simétrica y abierta, a menudo lleva a tablas.", "Symmetrical and open, often leads to draws."),
    ("C16", "French Defense: Winawer", "1. e4 e6 2. d4 d5 3. Nc3 Bb4", "rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 2 4",
     "Francesa: Variante Winawer", "Aguda y desequilibrada.", "Sharp and unbalanced."),
    ("B12", "Caro-Kann: Advance", "1. e4 c6 2. d4 d5 3. e5", "rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3",
     "Caro-Kann: Variante del Avance", "Similar a la francesa pero el alfil puede salir.", "Similar to French but the bishop can exit."),
    ("B13", "Caro-Kann: Panov Attack", "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4", "rnbqkbnr/pp2pppp/8/3p4/2PP4/8/PP3PPP/RNBQKBNR b KQkq - 0 4",
     "Caro-Kann: Ataque Panov", "Las blancas aceptan un peón aislado por actividad.", "White accepts an isolated pawn for activity."),
    ("C51", "Evans Gambit", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4", "r1bqk1nr/pppp1ppp/2n5/2b1p3/1P2P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4",
     "Gambito Evans", "Sacrificio de peón para desviar el alfil y ganar tiempos.", "Pawn sacrifice to deflect the bishop and gain tempo."),
    ("C44", "Scotch Gambit", "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Bc4", "r1bqkbnr/pppp1ppp/2n5/8/2BpP3/5N2/PPP2PPP/RNBQK2R b KQkq - 1 4",
     "Gambito Escocés", "Desarrollo rápido sacrificando el peón central.", "Rapid development sacrificing the central pawn."),
    ("D08", "Albin Countergambit", "1. d4 d5 2. c4 e5", "rnbqkbnr/ppp2ppp/8/3pp3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 2",
     "Contragambito Albin", "Respuesta agresiva al Gambito de Dama.", "Aggressive response to the Queen's Gambit."),
    ("A52", "Budapest Gambit", "1. d4 Nf6 2. c4 e5", "rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 2",
     "Gambito Budapest", "Sacrificio temporal para evitar líneas cerradas.", "Temporary sacrifice to avoid closed lines."),
    ("D00", "Blackmar-Diemer Gambit", "1. d4 d5 2. e4", "rnbqkbnr/ppp1pppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 1",
     "Gambito Blackmar-Diemer", "Muy peligroso a nivel de club, ataque directo.", "Very dangerous at club level, direct attack."),
    ("C40", "Latvian Gambit", "1. e4 e5 2. Nf3 f5", "rnbqkbnr/ppppp1pp/8/4Pp2/8/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 2",
     "Gambito Letón", "Considerada dubiosa pero muy táctica.", "Considered dubious but very tactical."),
    ("C40", "Elephant Gambit", "1. e4 e5 2. Nf3 d5", "rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2",
     "Gambito Elefante", "Un contraataque inmediato en el centro.", "An immediate center counter-attack."),
    ("A03", "Bird's Opening: From's Gambit", "1. f4 e5", "rnbqkbnr/pppp1ppp/8/4p3/5P2/8/PPPPP1PP/RNBQKBNR w KQkq - 0 1",
     "Apertura Bird: Gambito From", "Las negras ofrecen un peón para debilitar al rey blanco.", "Black offers a pawn to weaken the White king."),
    ("A87", "Dutch Defense: Leningrad", "1. d4 f5 2. c4 Nf6 3. g3 g6", "rnbqkb1r/ppppp2p/5np1/8/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq - 0 3",
     "Holandesa Leningrado", "Híbrido entre la Holandesa y la India de Rey.", "Hybrid between Dutch and King's Indian."),
    ("A90", "Dutch Defense: Stonewall", "1. d4 f5 2. c4 e6 3. g3 d5", "rnbqkbnr/ppp3pp/4p3/3p1p2/2PP4/6P1/PP2PP1P/RNBQKBNR w KQkq - 0 4",
     "Holandesa Muro de Piedra", "Estructura de peones muy sólida controlando e4.", "Very solid pawn structure controlling e4."),
    ("E97", "King's Indian: Classical", "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2", "rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 1 6",
     "India de Rey: Clásica", "La línea principal de esta compleja apertura.", "The main line of this complex opening."),
    ("E80", "King's Indian: Sämisch", "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3", "rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP2B1PP/R1BQK1NR b KQkq - 0 5",
     "India de Rey: Variante Sämisch", "Sólida formación de peones blanca para ataque.", "Solid white pawn formation for attack."),
    ("D43", "Semi-Slav Defense", "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6", "rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5",
     "Defensa Semieslava", "Muy compleja, combina la Eslava y el Gambito de Dama.", "Very complex, combines Slav and Queen's Gambit."),
    ("D15", "Slav Defense: Chebanenko", "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 a6", "rnbqkb1r/1p2pppp/p1p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5",
     "Eslava Chebanenko", "Prepara b5 y desarrollo flexible.", "Prepares b5 and flexible development."),
    ("D07", "Chigorin Defense", "1. d4 d5 2. c4 Nc6", "r1bqkbnr/ppp1pppp/2n5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 1 2",
     "Defensa Chigorin", "Juego de piezas activo contra el centro blanco.", "Active piece play against white center."),
    ("A30", "English: Symmetrical", "1. c4 c5", "rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 2",
     "Inglesa Simétrica", "Las negras copian el plan de las blancas.", "Black copies White's plan."),
    ("A09", "Réti Opening: Advance", "1. Nf3 d5 2. c4", "rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq - 0 2",
     "Apertura Réti: Gambito", "Ataca d5 desde el flanco inmediatamente.", "Attacks d5 from the flank immediately."),
    ("B09", "Pirc Defense: Austrian Attack", "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. f4", "rnbqkb1r/ppp1pp1p/3p1np1/8/3PPP2/2N5/PPP3PP/R1BQKBNR b KQkq - 0 4",
     "Pirc: Ataque Austriaco", "El intento más agresivo de refutar la Pirc.", "The most aggressive attempt to refute the Pirc."),
    ("B34", "Sicilian: Accelerated Dragon", "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 g6", "r1bqkbnr/pp1ppp1p/2n3p1/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5",
     "Siciliana: Dragón Acelerado", "Fianchetto rápido evitando el ataque Yugoslavo.", "Fast fianchetto avoiding the Yugoslav Attack."),
    ("C24", "Bishop's Opening: Berlin", "1. e4 e5 2. Bc4 Nf6", "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
     "Apertura Alfil: Defensa Berlín", "Sólida respuesta desarrollando el caballo.", "Solid response developing the knight."),
    ("A20", "English: King's English", "1. c4 e5", "rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 1",
     "Inglesa: Variante Siciliana Invertida", "Las blancas juegan una siciliana con un tiempo extra.", "White plays a Sicilian with an extra tempo.")
])


new_openings_data.extend([
    # Batch 4 - Deeper & Rare
    ("C78", "Ruy Lopez: Archangelsk Variation", "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Bb7",
     "r2qkb1r/1bpp1ppp/p1n2n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQ1RK1 w kq - 2 7",
     "Ruy Lopez: Variante Arcángel", "Aguda y táctica, las negras fianchettan el alfil de dama.",
     "Sharp and tactical, Black fianchettoes the queenside bishop."),
    ("C92", "Ruy Lopez: Closed (Zaitsev)", "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Bb7",
     "r2q1rk1/1bp1bppp/p1np1n2/1p2p3/4P3/1BPP1N1P/PP3PP1/RNBQR1K1 w - - 2 10",
     "Ruy Lopez: Variante Zaitsev", "Una de las líneas principales más complejas.", "One of the most complex main lines."),
    ("C63", "Ruy Lopez: Schliemann Defense", "1. e4 e5 2. Nf3 Nc6 3. Bb5 f5",
     "r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 3",
     "Ruy Lopez: Defensa Schliemann", "Agresiva desde la jugada 3, desafiando el centro blanco.", "Aggressive from move 3, challenging White's center."),
    ("C66", "Ruy Lopez: Steinitz Defense", "1. e4 e5 2. Nf3 Nc6 3. Bb5 d6",
     "r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 3",
     "Ruy Lopez: Defensa Steinitz", "Sólida pero pasiva, popularizada por el primer campeón mundial.", "Solid but passive, popularized by the first World Champion."),
    ("B30", "Sicilian: Rossolimo Attack", "1. e4 c5 2. Nf3 Nc6 3. Bb5",
     "r1bqkbnr/pp1ppppp/2n5/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
     "Siciliana: Ataque Rossolimo", "Evita la teoría principal y busca esquemas posicionales.", "Avoids main theory and seeks positional schemes."),
    ("B51", "Sicilian: Moscow Variation", "1. e4 c5 2. Nf3 d6 3. Bb5+",
     "rnbqkbnr/pp2pppp/3p4/1B6/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 3",
     "Siciliana: Variante Moscú", "Sólida opción para evitar la Najdorf.", "Solid option to avoid the Najdorf."),
    ("B50", "Sicilian: Wing Gambit", "1. e4 c5 2. b4",
     "rnbqkbnr/pp1ppppp/8/2p5/1P2P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2",
     "Siciliana: Gambito de Ala", "Sacrificio lateral para desviar el peón c.", "Flank sacrifice to deflect the c-pawn."),
    ("B99", "Sicilian: Najdorf (Main Line)", "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6 7. f4 Be7 8. Qf3 Qc7 9. O-O-O Nbd7",
     "r3k2r/1pqnbppp/p2ppn2/6B1/3NPP2/2N2Q2/PPP3PP/2KR1B1R w kq - 5 10",
     "Siciliana Najdorf: Línea Principal", "La batalla teórica definitiva en ajedrez.", "The ultimate theoretical battle in chess."),
    ("C11", "French: Classical (Burn)", "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 dxe4",
     "rnbqkb1r/ppp2ppp/4pn2/6B1/3Pp3/2N5/PPP2PPP/R2QKBNR w KQkq - 0 5",
     "Francesa: Variante Burn", "Línea sólida y combativa.", "Solid and combative line."),
    ("C18", "French: Winawer (Poisoned Pawn)", "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7 7. Qg4 Qc7 8. Qxg7",
     "rnb1k2r/ppq1npQp/4p3/2ppP3/3P4/P1P5/2P2PPP/R1B1KBNR b KQkq - 0 8",
     "Francesa: Winawer (Peón Envenenado)", "Una de las variantes más locas y analizadas.", "One of the wildest and most analyzed variations."),
    ("B18", "Caro-Kann: Classical", "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5",
     "rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5",
     "Caro-Kann: Clásica", "Desarrollo lógico y estructura muy sólida.", "Logical development and very solid structure."),
    ("B17", "Caro-Kann: Steinitz", "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7",
     "rnbqkbnr/pp1npppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5",
     "Caro-Kann: Variante Karpov/Steinitz", "Sólida y flexible, evitando debilidades tempranas.", "Solid and flexible, avoiding early weaknesses."),
    ("D11", "Slav: Exchange Variation", "1. d4 d5 2. c4 c6 3. cxd5 cxd5",
     "rnbqkbnr/pp2pppp/8/3p4/3P4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
     "Eslava: Variante del Cambio", "Simétrica y a menudo tablífera, pero requiere precisión.", "Symmetrical and often drawish, but mainly requires precision."),
    ("D46", "Semi-Slav: Meran", "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. e3 Nbd7 6. Bd3 dxc4 7. Bxc4 b5",
     "r1bqkb1r/p2n1ppp/2p1pn2/1p6/2BP4/2N1PN2/PP3PPP/R1BQK2R w KQkq - 0 8",
     "Semieslava: Variante Merano", "Contraataque en el flanco de dama con b5.", "Queenside counter-attack with b5."),
    ("D44", "Semi-Slav: Botvinnik", "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. Bg5 dxc4 6. e4 b5",
     "rnbqkb1r/p4ppp/2p1pn2/1p4B1/2pPP3/2N2N2/PP3PPP/R2QKB1R w KQkq - 0 7",
     "Semieslava: Variante Botvinnik", "Caos total en el tablero. Táctica pura.", "Total chaos on the board. Pure tactics."),
    ("E32", "Nimzo-Indian: Classical (4. Qc2)", "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2",
     "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR b KQkq - 1 4",
     "Nimzo-India: Clásica", "Las blancas evitan peones doblados.", "White avoids doubled pawns."),
    ("E41", "Nimzo-Indian: Hübner", "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 c5",
     "rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQkq - 1 5",
     "Nimzo-India: Variante Hübner", "Bloqueo central estratégico.", "Strategic central blockade."),
    ("E00", "Catalan Opening", "1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2",
     "rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR b KQkq - 1 4",
     "Apertura Catalana", "Posicional y sofisticada, combinación de Gambito de Dama y Réti.", "Positional and sophisticated, combining Queen's Gambit and Réti."),
    ("A45", "Trompowsky: Borg Defense", "1. d4 Nf6 2. Bg5 Ne4 3. Bf4",
     "rnbqkb1r/pppppppp/8/8/3PnB2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 3",
     "Trompowsky: Defensa Borg", "Las negras mueven el caballo dos veces para desafiar al alfil.", "Black moves the Knight twice to challenge the Bishop."),
    ("A80", "Dutch: Raphael Variation", "1. d4 f5 2. Nc3 Nf6 3. Bg5",
     "rnbqkb1r/ppppp1pp/5n2/5pB1/3P4/2N5/PPP1PPPP/R2QKBNR b KQkq - 3 3",
     "Holandesa: Variante Raphael", "Intento blanco de evitar la Holandesa principal con desarrollo rápido.", "White's attempt to avoid main Dutch with rapid development."),
    ("C20", "Wayward Queen Attack", "1. e4 e5 2. Qh5",
     "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2",
     "Ataque de la Reina", "Apertura de principiante buscando el Mate Pastor.", "Beginner opening aiming for Scholar's Mate."),
    ("C41", "Philidor: Hanham", "1. e4 e5 2. Nf3 d6 3. d4 Nd7",
     "r1bqkbnr/pppn1ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 1 4",
     "Philidor: Variante Hanham", "Método sólido para mantener e5 fuerte.", "Solid method to keep e5 strong."),
    ("B00", "Guatemala Defense", "1. e4 b5",
     "rnbqkbnr/p1pppppp/8/1p6/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
     "Defensa Guatemala", "Gambito dudoso por el flanco.", "Dubious flank gambit."),
    ("A56", "Benoni: Czech", "1. d4 Nf6 2. c4 c5 3. d5 e5",
     "rnbqkb1r/pp1p1ppp/5n2/2pPp3/2P5/8/PP2PPPP/RNBQKBNR w KQkq - 0 4",
     "Benoni Checa", "Cierra el centro completamente.", "Completely closes the center."),
    ("A51", "Budapest: Fajarowicz", "1. d4 Nf6 2. c4 e5 3. dxe5 Ne4",
     "rnbqkb1r/pppp1ppp/8/4P3/2P1n3/8/PP2PPPP/RNBQKBNR w KQkq - 1 4",
     "Budapest: Fajarowicz", "Juego de piezas activo en lugar de recuperar el peón.", "Active piece play instead of recovering the pawn."),
    ("B06", "Modern: Monkey's Bum", "1. e4 g6 2. Bc4 Bg7 3. Qf3 e6 4. d4 Bxd4",
     "rnbqk1nr/pppp1p1p/4p1p1/8/2BbP3/5Q2/PPP2PPP/RNB1K1NR w KQkq - 0 5",
     "Defensa Moderna: Variante del Mono", "Gambito dudoso pero divertido.", "Dubious but fun gambit."),
    ("A29", "English: Four Knights (Rev)", "1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3",
     "r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/2N2NP1/PP1PPP1P/R1BQKB1R b KQkq - 0 4",
     "Inglesa: Variante Fianchetto", "Posicional y sólida.", "Positional and solid."),
    ("A35", "English: Symmetrical (4 pawns)", "1. c4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. e3",
     "r1bqk1nr/pp1pppbp/2n3p1/2p5/2P5/2N1P1P1/PP1P1PBP/R1BQK1NR w KQkq - 0 6",
     "Inglesa: Sistema Botvinnik", "Control total sobre d5 con peones.", "Total control over d5 with pawns."),
    ("C44", "Danish Gambit", "1. e4 e5 2. d4 exd4 3. c3",
     "rnbqkbnr/pppp1ppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b KQkq - 0 3",
     "Gambito Danés", "Doble sacrificio de peón para alfiles monstruosos.", "Double pawn sacrifice for monster bishops."),
    ("C44", "Goring Gambit", "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3",
     "r1bqkbnr/pppp1ppp/2n5/8/3pP3/2P2N2/PP3PPP/RNBQKB1R b KQkq - 0 4",
     "Gambito Goring", "Primo del Danés pero con caballo fuera.", "Cousin of the Danish but with knight out."),
    ("D00", "Amazon Attack", "1. d4 d5 2. Qd3",
     "rnbqkbnr/ppp1pppp/8/3p4/3P4/3Q4/PPP1PPPP/RNB1KBNR b KQkq - 1 2",
     "Ataque Amazona", "Moviendo la dama temprano sin mucho sentido.", "Moving the queen early without much sense."),
    ("A00", "Ware Opening", "1. a4",
     "rnbqkbnr/pppppppp/8/8/P7/8/1PPPPPPP/RNBQKBNR b KQkq - 0 1",
     "Apertura Ware", "Controla... a4?", "Controls... a4?"),
    ("A00", "Anderssen's Opening", "1. a3",
     "rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1",
     "Apertura Anderssen", "Flexible, espera a ver qué hacen las negras.", "Flexible, waits to see what Black does."),
    ("A00", "Clemenz Opening", "1. h3",
     "rnbqkbnr/pppppppp/8/8/8/7P/PPPPPPP1/RNBQKBNR b KQkq - 0 1",
     "Apertura Clemenz", "Profilaxis prematura.", "Premature prophylaxis."),
    ("A00", "Desprez Opening", "1. h4",
     "rnbqkbnr/pppppppp/8/8/7P/8/PPPPPPP1/RNBQKBNR b KQkq - 0 1",
     "Apertura Kadas", "Agresión sin sentido en el flanco.", "Senseless aggression on the flank."),
    ("A40", "Englund Gambit", "1. d4 e5",
     "rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
     "Gambito Englund", "Truco barato esperando colgarse la dama.", "Cheap trick hoping for a queen hang."),
    ("B20", "Sicilian: Snyder Variation", "1. e4 c5 2. b3",
     "rnbqkbnr/pp1ppppp/8/2p5/4P3/1P6/P1PP1PPP/RNBQKBNR b KQkq - 0 2",
     "Siciliana: Variante Snyder", "Fianchetto contra la Siciliana.", "Fianchetto against the Sicilian."),
    ("C20", "Napoleon Opening", "1. e4 e5 2. Qf3",
     "rnbqkbnr/pppp1ppp/8/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR b KQkq - 1 2",
     "Apertura Napoleón", "Similar al Wayward Queen.", "Similar to Wayward Queen."),
    ("C50", "Italian: Greco Gambit", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3",
     "r1bqk2r/pppp1ppp/2n2n2/8/1b1PP3/2N2N2/PP3PPP/R1BQKB1R b KQkq - 1 7",
     "Italiana: Gambito Greco", "Ataque romántico clásico del siglo XVII.", "Classic romantic attack from the 17th century."),
    ("C52", "Evans Gambit: Accepted", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5",
     "r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6",
     "Gambito Evans Aceptado", "Línea principal, las blancas preparan d4.", "Main line, White prepares d4."),
    ("B01", "Scandinavian: Portuguese", "1. e4 d5 2. exd5 Nf6 3. d4 Bg4",
     "rn1qkb1r/ppp1pppp/5n2/3P4/3P2b1/8/PPP2PPP/RNBQKBNR w KQkq - 1 4",
     "Escandinava: Variante Portuguesa", "Gambito agudo por iniciativa.", "Sharp gambit for initiative."),
    ("B01", "Scandinavian: Icelandic", "1. e4 d5 2. exd5 Nf6 3. c4 e6",
     "rnbqkb1r/ppp2ppp/4pn2/3P4/2P5/8/PP1P1PPP/RNBQKBNR w KQkq - 0 4",
     "Gambito Islandés", "Sacrificio de peón por desarrollo rápido.", "Pawn sacrifice for rapid development."),
    ("C45", "Scotch: Mieses Variation", "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6",
     "r1bqkb1r/pppp1ppp/2N2n2/8/4P3/8/PPP2PPP/RNBQKB1R b KQkq - 0 5",
     "Escocesa: Variante Mieses", "Crea desequilibrios estructurales.", "Creates structural imbalances."),
    ("E70", "KID: Fianchetto", "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. g3",
     "rnbqk2r/ppppppbp/5np1/8/2PP4/2N3P1/PP2PP1P/R1BQKBNR b KQkq - 0 4",
     "India de Rey: Fianchetto", "Enfoque posicional contra el ataque negro.", "Positional approach to stifle Black's attack."),
    ("E90", "KID: Four Pawns Attack", "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f4",
     "rnbqk2r/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP4PP/R1BQKBNR b KQkq - 0 5",
     "India de Rey: Cuatro Peones", "Centro masivo, ¿se sostendrá?", "Massive center, will it hold?"),
    ("A65", "Benoni: Modern Main Line", "1. d4 Nf6 2. c4 c5 3. d5 e6 4. Nc3 exd5 5. cxd5 d6 6. e4 g6",
     "rnbqkb1r/pp3p1p/3p1np1/2pP4/4P3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 7",
     "Benoni Moderna: Línea Principal", "Estructura dinámica típica.", "Typical dynamic structure."),
    ("A43", "Old Benoni", "1. d4 c5 2. d5",
     "rnbqkbnr/pp1ppppp/8/2pP4/8/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2",
     "Benoni Antigua", "La versión original, menos común hoy.", "The original version, less common today."),
    ("B00", "Barnes Defense", "1. e4 f6",
     "rnbqkbnr/ppppp1pp/5p2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
     "Defensa Barnes", "Considerada una de las peores respuestas a e4.", "Considered one of the worst responses to e4."),
    ("A00", "Durkin Opening", "1. Na3",
     "rnbqkbnr/pppppppp/8/8/8/N7/PPPPPPPP/R1BQKBNR b KQkq - 1 1",
     "Ataque Durkin", "El caballo sale por el borde.", "Knight develops to the rim."),
    ("A00", "Amar Opening", "1. Nh3",
     "rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R b KQkq - 1 1",
     "Apertura Amar", "Desarrollo excéntrico del caballo.", "Eccentric Knight development."),
    ("C20", "King's Head Opening", "1. e4 e5 2. f3",
     "rnbqkbnr/pppp1ppp/8/4p3/4P3/5P2/PPPP2PP/RNBQKBNR b KQkq - 0 2",
     "Apertura Cabeza de Rey", "Debilita todo sin razón aparente.", "Weakens everything for no apparent reason."),
    # Batch 4 additions (from idempotency fix attempt)
    ("C57", "Two Knights: Fried Liver Attack", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7", "r1bqkb1r/ppp2Npp/2n5/3np3/2B5/8/PPPP1PPP/RNBQK2R b KQkq - 0 6",
     "Ataque Fegatello", "Sacrificio de caballo terrorífico contra el rey expuesto.", "Terrifying knight sacrifice against the exposed king."),
    ("C57", "Two Knights: Traxler Counterattack", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 Bc5", "r1bqk2r/pppp1ppp/2n2n2/2b1p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 5 5",
     "Contraataque Traxler", "Las negras ignoran la amenaza en f7 para contraatacar en f2.", "Black ignores the f7 threat to counter-attack on f2."),
    ("C47", "Four Knights: Halloween Gambit", "1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. Nxe5", "r1bqkb1r/pppp1ppp/5n2/4N3/4P3/2N5/PPPP1PPP/R1BQKB1R b KQkq - 0 4",
     "Gambito Halloween", "Sacrificio especulativo de caballo por un centro masivo.", "Speculative knight sacrifice for a massive center."),
    ("D01", "Richter-Veresov Attack", "1. d4 d5 2. Nc3 Nf6 3. Bg5", "rnbqkb1r/ppp1pppp/5n2/3p2B1/3P4/2N5/PPP1PPPP/R2QKBNR b KQkq - 3 3",
     "Ataque Richter-Veresov", "Agresivo y directo, buscando un rápido desarrollo.", "Aggressive and direct, seeking rapid development."),
    ("A53", "Old Indian Defense", "1. d4 Nf6 2. c4 d6 3. Nc3 e5", "rnbqkb1r/ppp2ppp/3p1n2/4p3/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 4",
     "Defensa India Antigua", "Sólida pero algo pasiva, las negras mantienen el centro cerrado.", "Solid but slightly passive, Black keeps the center closed."),
    ("B00", "Hippopotamus Defense", "1. g3 g6 2. Bg2 Bg7 3. d3 d6", "rnbqk1nr/ppp1ppbp/3p2p1/8/8/3P2P1/PPP1PPBP/RNBQK1NR w KQkq - 0 4",
     "Defensa Hipopótamo", "Un sistema universal donde las negras se esconden tras tres filas de peones.", "A universal system where Black hides behind three rows of pawns."),
    ("A10", "English: Adorjan Defense", "1. c4 g6 2. e4 e5", "rnbqkbnr/pppp1p1p/6p1/4p3/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq - 0 3",
     "Defensa Adorjan", "Respuesta creativa contra la Inglesa.", "Creative response to the English."),
    ("C27", "Vienna Game: Frankenstein-Dracula", "1. e4 e5 2. Nc3 Nf6 3. Bc4 Nxe4", "rnbqkb1r/pppp1ppp/8/4p3/2B1n3/2N5/PPPP1PPP/R1BQK1NR w KQkq - 0 4",
     "Variante Frankenstein-Drácula", "Una línea salvaje y complicada de la Vienesa.", "A wild and complicated line of the Vienna."),
    ("C33", "King's Gambit Accepted", "1. e4 e5 2. f4 exf4", "rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR w KQkq - 0 2",
     "Gambito de Rey Aceptado", "El reto clásico: ¿pueden las blancas demostrar compensación?", "The classic challenge: can White prove compensation?"),
    ("C30", "King's Gambit Declined: Falkbeer", "1. e4 e5 2. f4 d5", "rnbqkbnr/ppp2ppp/8/3pp3/4PP2/8/PPPP2PP/RNBQKBNR w KQkq - 0 2",
     "Contragambito Falkbeer", "Las negras contraatacan en el centro inmediatamente.", "Black counter-attacks in the center immediately."),
    ("C44", "Ponziani: Fraser Defense", "1. e4 e5 2. Nf3 Nc6 3. c3 Nf6 4. d4 Nxe4", "r1bqkb1r/pppp1ppp/2n5/4p3/3Pn3/2P2N2/PP3PPP/RNBQKB1R w KQkq - 0 5",
     "Ponziani: Defensa Fraser", "Respuesta táctica contra el centro de peones blanco.", "Tactical response against White's pawn center."),
    ("C22", "Center Game: Paulsen", "1. e4 e5 2. d4 exd4 3. Qxd4 Nc6 4. Qe3", "r1bqkbnr/pppp1ppp/2n5/8/4P3/4Q3/PPP2PPP/RNB1KBNR b KQkq - 1 4",
     "Apertura del Centro: Ataque Paulsen", "La reina blanca se coloca en una casilla activa.", "The white queen takes an active square."),
    ("C24", "Bishop's Opening: Urusov Gambit", "1. e4 e5 2. Bc4 Nf6 3. d4 exd4 4. Nf3", "rnbqkb1r/pppp1ppp/5n2/8/2BpP3/5N2/PPP2PPP/RNBQK2R b KQkq - 1 4",
     "Gambito Urusov", "Sacrificio de peón para un desarrollo masivo.", "Pawn sacrifice for massive development."),
    ("A85", "Dutch: Bellon Gambit", "1. d4 f5 2. c4 Nf6 3. Nc3 e5", "rnbqkb1r/pppp2pp/5n2/4pp2/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4",
     "Gambito Bellon", "Sacrificio sorpresa en la Holandesa.", "Surprise sacrifice in the Dutch."),
    ("A50", "Mexican Defense", "1. d4 Nf6 2. c4 Nc6", "r1bqkb1r/pppppppp/2n2n2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 1 3",
     "Defensa Mexicana", "Una defensa de los dos caballos contra d4.", "A Two Knights Defense against d4."),
    ("B22", "Sicilian: Alapin", "1. e4 c5 2. c3", "rnbqkbnr/pp1ppppp/8/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR b KQkq - 0 2",
     "Siciliana Alapin", "Antisiciliana sólida, buscando d4 inmediatamente.", "Solid Anti-Sicilian, aiming for d4 immediately."),
    ("B21", "Sicilian: Smith-Morra Gambit", "1. e4 c5 2. d4 cxd4 3. c3", "rnbqkbnr/pp1ppppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b KQkq - 0 3",
     "Gambito Smith-Morra", "Sacrificio de peón para ataque rápido y líneas abiertas.", "Pawn sacrifice for rapid attack and open lines."),
    ("B80", "Sicilian: Scheveningen", "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6", "rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
     "Siciliana Scheveningen", "Estructura de «pequeño centro» muy flexible.", "Very flexible 'small center' structure."),
    ("B56", "Sicilian: Classical", "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6", "r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 2 6",
     "Siciliana Clásica", "Desarrollo natural combatiendo por d4.", "Natural development fighting for d4."),
    ("B44", "Sicilian: Taimanov", "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6", "r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5",
     "Siciliana Taimanov", "Flexible, a menudo las negras no fianchettan ni juegan d6 pronto.", "Flexible, often Black mostly delays d6 and fianchetto."),
    ("B41", "Sicilian: Kan", "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6", "rnbqkbnr/1p1p1ppp/p3p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5",
     "Siciliana Kan", "Muy flexible, controla casillas negras sin comprometer peones centrales.", "Very flexible, controls dark squares without committing center pawns."),
    ("D38", "QGD: Ragozin Defense", "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 Bb4", "rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5",
     "Defensa Ragozin", "Un sistema híbrido Nimzo-QGD activo.", "An active Nimzo-QGD hybrid system."),
    ("D32", "QGD: Tarrasch Defense", "1. d4 d5 2. c4 e6 3. Nc3 c5", "rnbqkbnr/pp3ppp/4p3/2pp4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4",
     "Defensa Tarrasch", "Las negras aceptan un peón aislado por juego de piezas libre.", "Black accepts an isolated pawn for free piece play."),
    ("D52", "QGD: Cambridge Springs", "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Nbd7 5. e3 c6 6. Nf3 Qa5", "r1b1kb1r/pp1n1ppp/2p1pn2/q2p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQkq - 1 7",
     "Defensa Cambridge Springs", "Contraataque en el flanco de dama clavando el caballo.", "Queenside counter-attack pinning the knight."),
    ("C10", "French: Rubinstein", "1. e4 e6 2. d4 d5 3. Nc3 dxe4", "rnbqkbnr/ppp2ppp/4p3/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 4",
     "Francesa: Variante Rubinstein", "Libera la tensión central para simplificar.", "Releases central tension to simplify."),
    ("B03", "Alekhine: Four Pawns Attack", "1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. c4 Nb6 5. f4", "rnbqkb1r/ppp1pppp/1n1p4/4P3/2PP1P2/8/PP4PP/RNBQKBNR b KQkq - 0 5",
     "Alekhine: Ataque de los Cuatro Peones", "El intento más ambicioso de castigar a las negras.", "The most ambitious attempt to punish Black."),
    ("A70", "Modern Benoni", "1. d4 Nf6 2. c4 c5 3. d5 e6", "rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq - 0 4",
     "Benoni Moderna", "La forma clásica de jugar la Benoni.", "The classic way to play the Benoni."),
    ("A80", "Dutch: Staunton Gambit", "1. d4 f5 2. e4", "rnbqkbnr/ppppp1pp/8/5p2/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
     "Gambito Staunton", "Sacrificio de peón para abrir líneas contra la Holandesa.", "Pawn sacrifice to open lines against the Dutch."),
    ("C46", "Three Knights Game", "1. e4 e5 2. Nf3 Nc6 3. Nc3", "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 3 3",
     "Apertura de los Tres Caballos", "Las negras evitan la simetría de los 4 caballos.", "Black avoids the 4-knights symmetry."),
    ("A00", "Saragossa Opening", "1. c3", "rnbqkbnr/pppppppp/8/8/8/2P5/PP1PPPPP/RNBQKBNR b KQkq - 0 1",
     "Apertura Zaragoza", "Pasiva pero sólida, preparando d4.", "Passive but solid, preparing d4."),
    ("A00", "Mieses Opening", "1. d3", "rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
     "Apertura Mieses", "Prepara e4 o g3, muy flexible.", "Prepares e4 or g3, very flexible."),
    ("A00", "Van 't Kruijs Opening", "1. e3", "rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
     "Apertura Van 't Kruijs", "Libera el alfil rey pero es pasiva.", "Frees king bishop but is passive."),
    ("A00", "Hungarian Opening", "1. g3", "rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR b KQkq - 0 1",
     "Apertura Húngara", "Fianchetto rey inmediato.", "Immediate King fianchetto."),
    ("A28", "English: Four Knights", "1. c4 e5 2. Nc3 Nc6 3. Nf3 Nf6", "r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq - 3 4",
     "Inglesa: Cuatro Caballos", "Posición muy compleja y rica.", "Very complex and rich position."),
    ("C20", "Portuguese Opening", "1. e4 e5 2. Bb5", "rnbqkbnr/pppp1ppp/8/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2",
     "Apertura Portuguesa", "Intenta sacar a las negras de la teoría.", "Attempts to take Black out of theory."),
    ("C50", "Giuoco Pianissimo", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3", "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4",
     "Giuoco Pianissimo", "La variante más tranquila de la Italiana.", "The quietest variation of the Italian."),
    ("B00", "St. George Defense", "1. e4 a6", "rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
     "Defensa St. George", "Famosa porque Miles ganó a Karpov con ella.", "Famous because Miles beat Karpov with it."),
    ("B00", "Owen's Defense", "1. e4 b6", "rnbqkbnr/p1pppppp/1p6/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
     "Defensa Owen", "Fianchetto de dama contra e4.", "Queenside fianchetto against e4."),
    ("A40", "Polish Defense", "1. d4 b5", "rnbqkbnr/p1pppppp/8/1p6/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
     "Defensa Polaca", "Versión negra de la Sokolsky contra d4.", "Black version of Sokolsky against d4."),
    ("C44", "Inverted Hungarian", "1. e4 e5 2. Nf3 Nc6 3. Be2", "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPPBPPP/RNBQK2R b KQkq - 3 3",
     "Húngara Invertida", "Sólida y evita trucos de la Ruy Lopez.", "Solid and avoids Ruy Lopez tricks.")
])


# Logic to shuffle and assign IDs
# We check existing JSON names to avoid duplicates if re-run.

existing_names_set = set()
try:
    with open("src/data/openings.json", "r") as f:
        loaded_current = json.load(f)
        for op in loaded_current:
            existing_names_set.add(op["name"])
except Exception:
    pass # File might not exist or empty

# Populate dict for families from ALL definitions in this file
families = {}
for item in new_openings_data:
    obj = create_opening(*item)
    
    # FILTER: If already in JSON, skip
    if obj["name"] in existing_names_set:
        continue

    fam = obj["family"]
    if fam not in families:
        families[fam] = []
    families[fam].append(obj)

# Shuffle lists within families
for fam in families:
    random.shuffle(families[fam])

# Interleave
# Simple algorithm: Pick random family (that wasn't last picked), pop item, append.
shuffled_openings = []
last_family = None
family_names = list(families.keys())

# Limit iterations to avoid infinite loop if one family dominates
total_new = sum(len(f) for f in families.values())

while len(shuffled_openings) < total_new:
    # Get available families
    available = [f for f in family_names if len(families[f]) > 0]
    
    if not available:
        break
        
    # Try to pick diverse
    candidates = [f for f in available if f != last_family]
    
    if not candidates:
        # Forced to pick same family (should be rare with many families)
        candidates = available
    
    choice = random.choice(candidates)
    shuffled_openings.append(families[choice].pop())
    last_family = choice

# Load existing content to append to (idempotency check done above, now we correct IDs)
current_data = []
if os.path.exists("src/data/openings.json"):
    with open("src/data/openings.json", "r") as f:
        try:
            current_data = json.load(f)
        except json.JSONDecodeError:
            current_data = []

# IDs
if current_data:
    start_id = max(d["id"] for d in current_data) + 1
else:
    start_id = 1

for op in shuffled_openings:
    op["id"] = start_id
    start_id += 1
    # Clean up auxiliary keys
    if "family" in op:
        del op["family"]
    current_data.append(op)

# Write back
with open("src/data/openings.json", "w") as f:
    json.dump(current_data, f, indent=4, ensure_ascii=False)

print(f"Added {len(shuffled_openings)} new openings. Total: {len(current_data)}")
