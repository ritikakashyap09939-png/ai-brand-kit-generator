(function () {
  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }

  function getInitials(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function getColorByRole(palette, role, defaults) {
    const color = palette.colors.find(c => c.role === role);
    return color?.hex || defaults[role] || '#4f46e5';
  }

  function getContrastColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#111111' : '#ffffff';
  }

  function createSVGElement(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }

  function createStyleElement(fontName) {
    const style = createSVGElement('style');
    const encoded = encodeURIComponent(fontName);
    style.textContent = `@import url('https://fonts.googleapis.com/css2?family=${encoded}&display=swap');`;
    return style;
  }

  function createCircleLogo(initals, fontName, colors) {
    const { primary, text } = colors;
    const textColor = getContrastColor(primary);
    const svg = createSVGElement('svg', {
      viewBox: '0 0 200 200',
      width: '200',
      height: '200',
      xmlns: 'http://www.w3.org/2000/svg',
    });
    svg.appendChild(createStyleElement(fontName));
    const circle = createSVGElement('circle', {
      cx: '100',
      cy: '100',
      r: '90',
      fill: primary,
    });
    const textEl = createSVGElement('text', {
      x: '100',
      y: '110',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-family': `"${fontName}", sans-serif`,
      'font-size': '72',
      'font-weight': '700',
      fill: textColor,
    });
    textEl.textContent = initals;
    svg.appendChild(circle);
    svg.appendChild(textEl);
    return svg;
  }

  function createRoundedSquareLogo(initals, fontName, colors) {
    const { accent, text } = colors;
    const textColor = getContrastColor(accent);
    const svg = createSVGElement('svg', {
      viewBox: '0 0 200 200',
      width: '200',
      height: '200',
      xmlns: 'http://www.w3.org/2000/svg',
    });
    svg.appendChild(createStyleElement(fontName));
    const rect = createSVGElement('rect', {
      x: '10',
      y: '10',
      width: '180',
      height: '180',
      rx: '39.6',
      ry: '39.6',
      fill: accent,
    });
    const textEl = createSVGElement('text', {
      x: '100',
      y: '110',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-family': `"${fontName}", sans-serif`,
      'font-size': '72',
      'font-weight': '700',
      fill: textColor,
    });
    textEl.textContent = initals;
    svg.appendChild(rect);
    svg.appendChild(textEl);
    return svg;
  }

  function createWordmarkLogo(name, fontName, colors) {
    const { text, accent, background } = colors;
    const svg = createSVGElement('svg', {
      viewBox: '0 0 400 140',
      width: '400',
      height: '140',
      xmlns: 'http://www.w3.org/2000/svg',
    });
    svg.appendChild(createStyleElement(fontName));
    const bgRect = createSVGElement('rect', {
      x: '0',
      y: '0',
      width: '400',
      height: '140',
      fill: background,
    });
    const textEl = createSVGElement('text', {
      x: '200',
      y: '70',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-family': `"${fontName}", sans-serif`,
      'font-size': '48',
      'font-weight': '700',
      fill: text,
    });
    textEl.textContent = name;
    const line = createSVGElement('rect', {
      x: '100',
      y: '110',
      width: '200',
      height: '4',
      rx: '2',
      ry: '2',
      fill: accent,
    });
    svg.appendChild(bgRect);
    svg.appendChild(textEl);
    svg.appendChild(line);
    return svg;
  }

  function serializeSVG(svg) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function createDownloadButtons(svg, name, variant, fontName, colors, card) {
    const actions = document.createElement('div');
    actions.className = 'logo-actions';

    const svgBtn = document.createElement('button');
    svgBtn.type = 'button';
    svgBtn.className = 'small-btn';
    svgBtn.textContent = 'Download SVG';
    svgBtn.addEventListener('click', () => {
      const svgString = serializeSVG(svg);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const filename = `${slugify(name)}-logo-${variant}.svg`;
      downloadBlob(blob, filename);
    });

    const pngBtn = document.createElement('button');
    pngBtn.type = 'button';
    pngBtn.className = 'small-btn';
    pngBtn.textContent = 'Download PNG';
    pngBtn.addEventListener('click', async () => {
      await renderPNG(svg, name, variant, fontName, colors);
    });

    actions.appendChild(svgBtn);
    actions.appendChild(pngBtn);
    card.appendChild(actions);
  }

  async function renderPNG(svg, name, variant, fontName, colors) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 1024;
    const height = variant === 'wordmark' ? 358 : 1024;
    canvas.width = width;
    canvas.height = height;

    await document.fonts.load(`700 100px "${fontName}"`);

    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, width, height);

    if (variant === 'circle') {
      const { primary, text } = colors;
      const textColor = getContrastColor(primary);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = width * 0.45;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = primary;
      ctx.fill();

      ctx.font = `700 ${radius * 0.8}px "${fontName}"`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initials = getInitials(name);
      ctx.fillText(initials, centerX, centerY + radius * 0.05);
    } else if (variant === 'square') {
      const { accent, text } = colors;
      const textColor = getContrastColor(accent);
      const size = width * 0.9;
      const x = (width - size) / 2;
      const y = (height - size) / 2;
      const radius = size * 0.22;

      ctx.beginPath();
      ctx.roundRect(x, y, size, size, radius);
      ctx.fillStyle = accent;
      ctx.fill();

      ctx.font = `700 ${size * 0.4}px "${fontName}"`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initials = getInitials(name);
      ctx.fillText(initials, width / 2, height / 2 + size * 0.02);
    } else if (variant === 'wordmark') {
      const { text: textColor, accent, background } = colors;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      let fontSize = 200;
      ctx.font = `700 ${fontSize}px "${fontName}"`;
      let metrics = ctx.measureText(name);
      while (metrics.width > width * 0.9 && fontSize > 20) {
        fontSize -= 4;
        ctx.font = `700 ${fontSize}px "${fontName}"`;
        metrics = ctx.measureText(name);
      }

      const x = width / 2;
      const y = height / 2 - 20;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x, y);

      const lineWidth = Math.min(metrics.width * 1.2, width * 0.6);
      const lineX = (width - lineWidth) / 2;
      const lineY = y + fontSize / 2 + 20;
      ctx.beginPath();
      ctx.roundRect(lineX, lineY, lineWidth, 8, 4);
      ctx.fillStyle = accent;
      ctx.fill();
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const filename = `${slugify(name)}-logo-${variant}.png`;
    downloadBlob(blob, filename);
  }

  window.renderLogos = function (kit, paletteIndex) {
    const logosSection = document.getElementById('logos');
    const h2 = logosSection.querySelector('h2');
    logosSection.innerHTML = '';
    logosSection.appendChild(h2);

    const businessNameInput = document.getElementById('businessName');
    const businessName = businessNameInput?.value?.trim() || 'Brand';
    const initials = getInitials(businessName);
    const headingFont = kit.fonts?.heading || 'Inter';

    const palette = kit.palettes[paletteIndex] || kit.palettes[0];
    const defaults = {
      primary: '#4f46e5',
      secondary: '#1e1b4b',
      accent: '#818cf8',
      background: '#ffffff',
      text: '#1e1b4b',
    };
    const colors = {
      primary: getColorByRole(palette, 'primary', defaults),
      secondary: getColorByRole(palette, 'secondary', defaults),
      accent: getColorByRole(palette, 'accent', defaults),
      background: getColorByRole(palette, 'background', defaults),
      text: getColorByRole(palette, 'text', defaults),
    };

    const grid = document.createElement('div');
    grid.className = 'logo-grid';

    const variants = [
      { key: 'circle', create: createCircleLogo, label: 'Circle' },
      { key: 'square', create: createRoundedSquareLogo, label: 'Rounded Square' },
      { key: 'wordmark', create: createWordmarkLogo, label: 'Wordmark' },
    ];

    variants.forEach(variant => {
      const card = document.createElement('div');
      card.className = 'logo-card';

      let svg;
      if (variant.key === 'wordmark') {
        svg = variant.create(businessName, headingFont, colors);
      } else {
        svg = variant.create(initials, headingFont, colors);
      }

      card.appendChild(svg);
      createDownloadButtons(svg, businessName, variant.key, headingFont, colors, card);
      grid.appendChild(card);
    });

    logosSection.appendChild(grid);
  };
})();