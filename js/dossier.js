/* /dossier/: el botón abre el diálogo de impresión del navegador (ahí se elige «Guardar como PDF»). */
(function(){
  var b = document.getElementById('dosPrint');
  if(b) b.addEventListener('click', function(){ window.print(); });
})();
