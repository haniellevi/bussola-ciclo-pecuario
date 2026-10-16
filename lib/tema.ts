// Tema escolhido no botão (automático, claro ou escuro), guardado só neste navegador.
export const CHAVE_TEMA = "bussola:tema";

// Roda antes de a página aparecer, para não piscar na cor errada.
export const scriptTema = `try{var t=localStorage.getItem("${CHAVE_TEMA}");if(t==="claro"||t==="escuro")document.documentElement.dataset.tema=t}catch(e){}`;
