(function () {
  const form = document.getElementById('brand-form');
  const btn = document.getElementById('create-btn');
  const statusEl = document.getElementById('status');
  const placeholder = document.getElementById('placeholder');
  const results = document.getElementById('results');
  const downloadBtn = document.getElementById('download-json');

  let kit = null;
  let selectedPaletteIndex = 0;

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = type;
  }

  function clearStatus() {
    statusEl.textContent = '';
    statusEl.className = '';
  }

  function setLoading(loading) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Creating your brand kit...' : 'Create my brand kit';
  }

  function getSelectedRadio(name) {
    const input = form.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : '';
  }

  async function callAPI(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 400) throw new Error('Please check your inputs.');
        if (res.status === 429) throw new Error('Bahut zyada requests, thodi der baad try karo.');
        throw new Error('Server busy hai, please dobara try karo.');
      }
      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        throw new Error('Server busy hai, please dobara try karo.');
      }
      throw err;
    }
  }

  function scrollToResults() {
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function copyToClipboard(text, button) {
    const isSwatch = button.classList.contains('swatch');
    let originalText = '';
    let hexSpan = null;

    if (isSwatch) {
      hexSpan = button.querySelector('.swatch-hex');
      originalText = hexSpan ? hexSpan.textContent : '';
    } else {
      originalText = button.textContent;
    }
    const originalClass = button.className;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showCopied(button);
      }).catch(() => {
        fallbackCopy(text, button);
      });
    } else {
      fallbackCopy(text, button);
    }

    function showCopied(btn) {
      if (isSwatch && hexSpan) {
        hexSpan.textContent = 'Copied!';
      } else {
        btn.textContent = 'Copied!';
      }
      btn.classList.add('copied');
      setTimeout(() => {
        if (isSwatch && hexSpan) {
          hexSpan.textContent = originalText;
        } else {
          btn.textContent = originalText;
        }
        btn.classList.remove('copied');
      }, 1200);
    }

    function fallbackCopy(text, btn) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showCopied(btn);
      } catch {
        if (isSwatch && hexSpan) {
          hexSpan.textContent = 'Failed';
        } else {
          btn.textContent = 'Failed';
        }
        setTimeout(() => {
          if (isSwatch && hexSpan) {
            hexSpan.textContent = originalText;
          } else {
            btn.textContent = originalText;
          }
        }, 1200);
      }
      document.body.removeChild(ta);
    }
  }

  function createCopyButton(text) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => copyToClipboard(text, btn));
    return btn;
  }

  function clearResults() {
    const sections = ['taglines', 'palettes', 'fonts', 'logos', 'voice', 'captions'];
    sections.forEach(id => {
      const section = document.getElementById(id);
      if (section) {
        const h2 = section.querySelector('h2');
        section.innerHTML = '';
        if (h2) section.appendChild(h2);
      }
    });
  }

  function loadGoogleFont(fontName) {
    return new Promise((resolve) => {
      const encoded = encodeURIComponent(fontName);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  function renderTaglines(taglines) {
    const container = document.getElementById('taglines');
    const h2 = container.querySelector('h2');
    container.innerHTML = '';
    container.appendChild(h2);

    taglines.forEach(text => {
      const row = document.createElement('div');
      row.className = 'tagline-row';

      const textEl = document.createElement('span');
      textEl.className = 'tagline-text';
      textEl.textContent = text;

      const copyBtn = createCopyButton(text);

      row.appendChild(textEl);
      row.appendChild(copyBtn);
      container.appendChild(row);
    });
  }

  function renderPalettes(palettes) {
    const container = document.getElementById('palettes');
    const h2 = container.querySelector('h2');
    container.innerHTML = '';
    container.appendChild(h2);

    palettes.forEach((palette, paletteIndex) => {
      const paletteEl = document.createElement('div');
      paletteEl.className = 'palette' + (paletteIndex === selectedPaletteIndex ? ' selected' : '');
      paletteEl.dataset.index = paletteIndex;

      const nameEl = document.createElement('div');
      nameEl.className = 'palette-name';
      nameEl.textContent = palette.name;

      const swatches = document.createElement('div');
      swatches.className = 'swatches';

      palette.colors.forEach(color => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'swatch';
        swatch.dataset.hex = color.hex;

        const colorBox = document.createElement('div');
        colorBox.className = 'swatch-color';
        colorBox.style.backgroundColor = color.hex;

        const roleEl = document.createElement('span');
        roleEl.className = 'swatch-role';
        roleEl.textContent = color.role;

        const hexEl = document.createElement('span');
        hexEl.className = 'swatch-hex';
        hexEl.textContent = color.hex;

        swatch.appendChild(colorBox);
        swatch.appendChild(roleEl);
        swatch.appendChild(hexEl);

        swatch.addEventListener('click', () => {
          copyToClipboard(color.hex, swatch);
        });

        swatches.appendChild(swatch);
      });

      paletteEl.appendChild(nameEl);
      paletteEl.appendChild(swatches);

      paletteEl.addEventListener('click', (e) => {
        if (e.target.closest('.swatch')) return;
        selectPalette(paletteIndex);
      });

      container.appendChild(paletteEl);
    });
  }

  function selectPalette(index) {
    selectedPaletteIndex = index;
    const palettes = document.querySelectorAll('#palettes .palette');
    palettes.forEach((p, i) => {
      p.classList.toggle('selected', i === index);
    });
    if (typeof window.renderLogos === 'function' && kit) {
      window.renderLogos(kit, selectedPaletteIndex);
    }
  }

  async function renderFonts(fonts, businessName, description) {
    const container = document.getElementById('fonts');
    const h2 = container.querySelector('h2');
    container.innerHTML = '';
    container.appendChild(h2);

    await Promise.all([
      loadGoogleFont(fonts.heading),
      loadGoogleFont(fonts.body),
    ]);

    const card = document.createElement('div');
    card.className = 'font-preview';

    const headingEl = document.createElement('div');
    headingEl.className = 'font-heading';
    headingEl.textContent = businessName;
    headingEl.style.fontFamily = `"${fonts.heading}", sans-serif`;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'font-body';
    bodyEl.textContent = description;
    bodyEl.style.fontFamily = `"${fonts.body}", sans-serif`;

    const whyEl = document.createElement('p');
    whyEl.className = 'font-why';
    whyEl.textContent = fonts.why;

    card.appendChild(headingEl);
    card.appendChild(bodyEl);
    card.appendChild(whyEl);
    container.appendChild(card);
  }

  function renderVoice(voice) {
    const container = document.getElementById('voice');
    const h2 = container.querySelector('h2');
    container.innerHTML = '';
    container.appendChild(h2);

    const tagsEl = document.createElement('div');
    tagsEl.className = 'voice-tags';

    voice.adjectives.forEach(adj => {
      const tag = document.createElement('span');
      tag.className = 'voice-tag';
      tag.textContent = adj;
      tagsEl.appendChild(tag);
    });

    const textEl = document.createElement('p');
    textEl.className = 'voice-text';
    textEl.textContent = voice.description;

    container.appendChild(tagsEl);
    container.appendChild(textEl);
  }

  function renderCaptions(captions) {
    const container = document.getElementById('captions');
    const h2 = container.querySelector('h2');
    container.innerHTML = '';
    container.appendChild(h2);

    captions.forEach(text => {
      const card = document.createElement('div');
      card.className = 'caption-card';

      const textEl = document.createElement('p');
      textEl.className = 'caption-text';
      textEl.textContent = text;

      const copyBtn = createCopyButton(text);

      card.appendChild(textEl);
      card.appendChild(copyBtn);
      container.appendChild(card);
    });
  }

  function renderKit(data) {
    kit = data;
    selectedPaletteIndex = 0;
    clearResults();

    renderTaglines(kit.taglines);
    renderPalettes(kit.palettes);
    renderFonts(kit.fonts, form.businessName.value.trim(), form.description.value.trim());
    renderVoice(kit.voice);
    renderCaptions(kit.captions);

    if (typeof window.renderLogos === 'function') {
      window.renderLogos(kit, selectedPaletteIndex);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearStatus();

    const businessName = form.businessName.value.trim();
    const description = form.description.value.trim();

    if (!businessName || !description) {
      showStatus('Please fill in all required fields.', 'error');
      return;
    }

    const vibe = getSelectedRadio('vibe');
    const language = getSelectedRadio('language');

    setLoading(true);

    try {
      const data = await callAPI({ businessName, description, vibe, language });
      renderKit(data);

      placeholder.hidden = true;
      results.hidden = false;
      scrollToResults();
    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!kit) return;
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brand-kit.json';
    a.click();
    URL.revokeObjectURL(url);
  });
})();