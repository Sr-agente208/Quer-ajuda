(function() {
  'use strict';

  // Aguarda o supabase.js inicializar
  function ready() {
    return new Promise((resolve) => {
      if (window.sbAPI) return resolve();
      const check = () => {
        if (window.sbAPI) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  let watchId = null;
  let lastPos = null;
  let lastSaved = 0;
  let isSharing = false;

  const WHATSAPP_RESPONSAVEL = '5511986059638'; // pode ser sobrescrito pelo profile

  function $(id) { return document.getElementById(id); }

  function toast(msg, type) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast-loc show ' + (type || '');
    setTimeout(() => { t.className = 'toast-loc'; }, 3000);
  }

  function formatarHora(d) {
    const pad = n => n < 10 ? '0' + n : '' + n;
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function distanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  async function salvarLocalizacao(pos) {
    const user = await window.sbAPI.getCurrentUser();
    if (!user) return;

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const acc = pos.coords.accuracy;

    // Salva no Supabase (a tabela será criada pela migration 002)
    try {
      await window.sbAPI.supabase
        .from('localizacoes')
        .upsert({
          user_id: user.id,
          lat: lat,
          lng: lng,
          accuracy: acc,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (e) {
      console.warn('Não conseguiu salvar localizacao (tabela pode não existir):', e.message);
    }

    // Atualiza UI
    $('info-endereco').textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
    $('info-hora').textContent = formatarHora(new Date());
    $('info-precisao').textContent = '±' + Math.round(acc) + 'm';
    $('loc-info').style.display = 'block';

    lastPos = pos;
    lastSaved = Date.now();
  }

  function erroGeo(err) {
    let msg = 'Não consegui pegar sua localização.';
    if (err.code === 1) msg = 'Você precisa permitir o acesso à localização.';
    else if (err.code === 2) msg = 'Localização indisponível no momento.';
    else if (err.code === 3) msg = 'Demorou demais pra pegar o sinal.';
    toast(msg, 'err');
    console.error('Geo error:', err);
  }

  async function compartilhar() {
    if (!('geolocation' in navigator)) {
      toast('Seu navegador não tem GPS.', 'err');
      return;
    }

    toast('Pedindo permissão...', 'ok');

    watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        await salvarLocalizacao(pos);
        if (!isSharing) {
          isSharing = true;
          $('btn-compartilhar').style.display = 'none';
          $('btn-parar').style.display = 'block';
          $('loc-status-card').classList.add('loc-status--active');
          $('loc-icon').textContent = '✅';
          $('loc-title').textContent = 'Compartilhando agora';
          $('loc-desc').textContent = 'Quem cuida de você consegue ver onde você está.';
          toast('Localização compartilhada!', 'ok');
        }
      },
      erroGeo,
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 30000
      }
    );

    // Reenvia a cada 60 segundos pra manter atualizado no Supabase
    if (!window._locInterval) {
      window._locInterval = setInterval(async () => {
        if (isSharing && lastPos) {
          await salvarLocalizacao(lastPos);
        }
      }, 60000);
    }
  }

  function pararCompartilhamento() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    isSharing = false;
    $('btn-compartilhar').style.display = 'block';
    $('btn-parar').style.display = 'none';
    $('loc-status-card').classList.remove('loc-status--active');
    $('loc-icon').textContent = '📍';
    $('loc-title').textContent = 'Compartilhar localização';
    $('loc-desc').textContent = 'Toque no botão verde pra deixar quem cuida de você saber onde você está.';
    $('loc-info').style.display = 'none';
    toast('Você parou de compartilhar.', 'ok');
  }

  async function enviarSOS() {
    const user = await window.sbAPI.getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return; }
    const profile = await window.sbAPI.getMyProfile();
    const nome = profile ? (profile.full_name || user.email) : user.email;

    toast('Pegando sua localização...', 'ok');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapsLink = 'https://maps.google.com/?q=' + lat + ',' + lng;
        const msg = encodeURIComponent(
          '🆘 *PEDIDO DE AJUDA - ' + nome + '*\n\n' +
          'Preciso de ajuda!\n\n' +
          '📍 Estou aqui: ' + mapsLink + '\n' +
          '🕐 ' + formatarHora(new Date())
        );

        // Pega o WhatsApp do responsável vinculado
        let zap = WHATSAPP_RESPONSAVEL;
        try {
          const { data: links } = await window.sbAPI.supabase
            .from('care_links')
            .select('responsavel_id')
            .eq('idoso_id', user.id);
          if (links && links.length > 0) {
            // Pega o profile do primeiro responsável
            const { data: respProfile } = await window.sbAPI.supabase
              .from('profiles')
              .select('phone')
              .eq('id', links[0].responsavel_id)
              .single();
            if (respProfile && respProfile.phone) {
              zap = respProfile.phone.replace(/\D/g, '');
            }
          }
        } catch (e) {
          console.warn('Sem responsável vinculado, usando número padrão', e);
        }

        // Salva no histórico
        try {
          await window.sbAPI.supabase.from('sos_alertas').insert({
            user_id: user.id,
            lat: lat,
            lng: lng,
            maps_link: mapsLink,
            created_at: new Date().toISOString()
          });
        } catch (e) { /* tabela pode não existir */ }

        // Abre WhatsApp
        const url = 'https://wa.me/' + zap + '?text=' + msg;
        window.open(url, '_blank');
        toast('Abrindo WhatsApp...', 'ok');
      },
      erroGeo,
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function avisarToBem() {
    const user = await window.sbAPI.getCurrentUser();
    if (!user) return;
    const profile = await window.sbAPI.getMyProfile();
    const nome = profile ? (profile.full_name || user.email) : user.email;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapsLink = 'https://maps.google.com/?q=' + lat + ',' + lng;
        const msg = encodeURIComponent(
          '✅ *Tô bem! - ' + nome + '*\n\n' +
          'Só passando pra avisar que tá tudo certo.\n\n' +
          '📍 ' + mapsLink + '\n' +
          '🕐 ' + formatarHora(new Date())
        );

        // Pega o WhatsApp do responsável vinculado
        let zap = WHATSAPP_RESPONSAVEL;
        try {
          const { data: links } = await window.sbAPI.supabase
            .from('care_links')
            .select('responsavel_id')
            .eq('idoso_id', user.id);
          if (links && links.length > 0) {
            const { data: respProfile } = await window.sbAPI.supabase
              .from('profiles')
              .select('phone')
              .eq('id', links[0].responsavel_id)
              .single();
            if (respProfile && respProfile.phone) {
              zap = respProfile.phone.replace(/\D/g, '');
            }
          }
        } catch (e) {}

        // Salva no histórico
        try {
          await window.sbAPI.supabase.from('checkins').insert({
            user_id: user.id,
            lat: lat,
            lng: lng,
            created_at: new Date().toISOString()
          });
        } catch (e) {}

        window.open('https://wa.me/' + zap + '?text=' + msg, '_blank');
        toast('Avisando quem cuida de você...', 'ok');
      },
      erroGeo,
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  ready().then(async () => {
    const user = await window.sbAPI.getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return; }

    const profile = await window.sbAPI.getMyProfile();
    if (profile && profile.role !== 'idoso') {
      // Se for responsável, redireciona pra tela de rastreamento
      window.location.href = 'rastreamento.html';
      return;
    }

    // Event listeners
    $('btn-compartilhar').addEventListener('click', compartilhar);
    $('btn-parar').addEventListener('click', pararCompartilhamento);
    $('btn-sos').addEventListener('click', enviarSOS);
    $('btn-tobom').addEventListener('click', avisarToBem);

    // Limpa quando sair
    window.addEventListener('beforeunload', () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    });
  });

})();
