(function(){
  // Visor universal de credenciales: PDF en <iframe>, imágenes JPG/PNG en <img> con scroll interior.
  var modal = document.getElementById('cvViewerModal');
  if(!modal || typeof modal.showModal !== 'function') return;

  var title = document.getElementById('cvTitle');
  // El <iframe> se crea al abrir el primer documento: tenerlo en el HTML cuesta ~120 ms de layout en cada carga del inicio.
  var iframe = null;
  function frame(){
    if(!iframe){
      iframe = document.createElement('iframe');
      iframe.id = 'cvIframe'; iframe.width = '100%'; iframe.height = '100%'; iframe.setAttribute('frameborder', '0'); iframe.hidden = true;
      iframe.title = (modal.querySelector('.cv-dialog-title .micro') || {}).textContent || '';
      imgWrap.parentNode.insertBefore(iframe, imgWrap);
    }
    return iframe;
  }
  var img = document.getElementById('cvImg');
  var imgWrap = document.getElementById('cvImgWrap');
  var fallback = document.getElementById('cvFallback');
  var download = document.getElementById('cvDownload');
  var newTab = document.getElementById('cvNewTab');
  var closeBtn = document.getElementById('cvClose');

  function extOf(file){
    var m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(file || '');
    return m ? m[1].toLowerCase() : '';
  }

  // Libera el documento/imagen: se ejecuta al cerrar (Esc, botón o backdrop) y antes de cada apertura.
  function reset(){
    if(iframe){ iframe.hidden = true; iframe.setAttribute('src', 'about:blank'); }
    imgWrap.hidden = true; fallback.hidden = true;
    img.removeAttribute('src');
    imgWrap.scrollTop = 0;
  }

  function open(file, name){
    reset();
    title.textContent = name || '';
    download.href = file;
    download.setAttribute('download', file.split('/').pop());
    newTab.href = file;
    var ext = extOf(file);
    if(ext === 'pdf'){
      var fr = frame();
      fr.setAttribute('src', file + '#toolbar=0&navpanes=0');
      fr.hidden = false;
    }else if(ext === 'jpg' || ext === 'jpeg' || ext === 'png'){
      img.alt = (name ? name + ' · ' : '') + img.getAttribute('data-alt');
      img.setAttribute('src', file);
      imgWrap.hidden = false;
    }else{
      fallback.hidden = false;
    }
    modal.showModal();
    closeBtn.focus();
  }

  document.addEventListener('click', function(e){
    var btn = e.target.closest('.cv-view-btn');
    if(!btn) return;
    open(btn.getAttribute('data-file'), btn.getAttribute('data-name'));
  });
  closeBtn.addEventListener('click', function(){ modal.close(); });
  // Clic en el backdrop: el <dialog> ocupa toda el área, así que el target es el propio dialog.
  modal.addEventListener('click', function(e){ if(e.target === modal) modal.close(); });
  modal.addEventListener('close', reset);
})();
