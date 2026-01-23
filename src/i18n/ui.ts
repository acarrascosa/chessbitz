export const ui = {
    es: {
        start: 'Inicio',
        prev: 'Anterior',
        next: 'Siguiente',
        end: 'Final',
        zenMode: 'Modo Zen',
        exitZen: 'Salir del Modo Zen',
        moveList: 'Lista de Movimientos',
        analysis: 'Análisis',
        shareTitle: '¡Apertura Completada!',
        shareDesc: 'Has aprendido algo nuevo hoy. Comparte tu progreso.',
        copyLink: 'Copiar Enlace',
        copied: '¡Enlace Copiado!',
        legal: 'Aviso Legal',
        developedBy: 'Desarrollado con ♥ por',
        buyMeCoffee: 'Invítame a un café'
    },
    en: {
        start: 'Start',
        prev: 'Prev',
        next: 'Next',
        end: 'End',
        zenMode: 'Zen Mode',
        exitZen: 'Exit Zen Mode',
        moveList: 'Move List',
        analysis: 'Analysis',
        shareTitle: 'Opening Completed!',
        shareDesc: 'You learned something new today. Share your progress.',
        copyLink: 'Copy Link',
        copied: 'Link Copied!',
        legal: 'Legal Notice',
        developedBy: 'Developed with ♥ by',
        buyMeCoffee: 'Buy Me a Coffee'
    }
};

export type UILanguage = keyof typeof ui;
export const defaultLang: UILanguage = 'es';
